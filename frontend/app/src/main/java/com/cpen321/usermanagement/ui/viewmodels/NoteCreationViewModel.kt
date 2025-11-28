package com.cpen321.usermanagement.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.*
import com.cpen321.usermanagement.data.repository.AuthRepository
import com.cpen321.usermanagement.data.repository.NoteRepository
import com.cpen321.usermanagement.data.repository.WorkspaceRepository
import com.cpen321.usermanagement.ui.navigation.NavigationStateManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import java.time.LocalDateTime
import javax.inject.Inject
import android.util.Log
import com.cpen321.usermanagement.data.repository.ProfileRepository
import com.cpen321.usermanagement.ui.components.FieldTypeDialog

enum class FieldType {
    TEXT,
    DATETIME,
    SIGNATURE
}

data class FieldCreationData(
    val id: String = UUID.randomUUID().toString(),
    val type: FieldType,
    val label: String = "",
    val placeholder: String? = null,
    val content: Any? = null,
    val userId: String? = null
)

sealed class FieldUpdate {
    data class Label(val value: String) : FieldUpdate()
    data class Placeholder(val value: String) : FieldUpdate()
    data class Content(val value: Any?) : FieldUpdate()
    data class Signature(val userId: String?, val placeholder: String?): FieldUpdate()
}

data class NoteCreationState(
    val noteType: NoteType = NoteType.CONTENT,
    val tags: List<String> = emptyList(),
    val fields: List<FieldCreationData> = emptyList(),
    val isCreating: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val isLoadingTemplate: Boolean = false,
    val user: User? = null
)

@HiltViewModel
class NoteCreationViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val noteRepository: NoteRepository,
    private val workspaceRepository: WorkspaceRepository,
    private val profileRepository: ProfileRepository,
    private val navigationStateManager: NavigationStateManager
) : ViewModel() {

    private val _creationState = MutableStateFlow(NoteCreationState())
    val creationState: StateFlow<NoteCreationState> = _creationState.asStateFlow()

    fun setNoteType(noteType: NoteType) {
        _creationState.value = _creationState.value.copy(noteType = noteType)
    }

    fun addTag(tag: String) {
        val currentTags = _creationState.value.tags
        if (tag.isNotBlank() && tag !in currentTags) {
            _creationState.value = _creationState.value.copy(
                tags = currentTags + tag
            )
        }
    }

    fun removeTag(tag: String) {
        _creationState.value = _creationState.value.copy(
            tags = _creationState.value.tags - tag
        )
    }

    fun addField(fieldType: FieldType) {
        val newField = FieldCreationData(
            type = fieldType,
            label = "New ${fieldType.name.lowercase()} field"
        )
        _creationState.value = _creationState.value.copy(
            fields = _creationState.value.fields + newField
        )
    }

    private suspend fun setFieldsToTemplate(noteId:String?)
    {
        if (noteId!=null){
            val noteRequest = noteRepository.getNote(noteId)
            if (noteRequest.isSuccess) { //if it is not successful the fields will not load
                val note = noteRequest.getOrNull()!!
                val fields = getFieldsForNote(note)

                //Also sets tags as they are part of template content
                _creationState.value = _creationState.value.copy(
                    fields = fields,
                    tags = note.tags
                )
            }
            else{
                _creationState.value = _creationState.value.copy(error = "Could not load template.")
            }
        }
    }

    private fun getFieldsForNote(note: Note):List<FieldCreationData>{
        val fields = mutableListOf<FieldCreationData>()
        for (field in note.fields) {
            val fieldType = when (field) {
                is TextField -> {
                    FieldType.TEXT
                }

                is DateTimeField -> {
                    FieldType.DATETIME
                }

                is SignatureField -> {
                    FieldType.SIGNATURE
                }
            }
            fields.add(FieldCreationData(type = fieldType, label = field.label))
        }

        // Ensure title field exists as first field
        if (fields.isEmpty() || fields.first().label != "Title") {
            fields.add(0, FieldCreationData(
                type = FieldType.TEXT,
                label = "Title",
                placeholder = "Enter title"
            ))
        }
        return fields
    }

    fun removeField(fieldId: String) {
        val fields = _creationState.value.fields
        // if fieldId is the first field (title), do nothing and exit
        if (fields.isNotEmpty() && fields.first().id == fieldId) {
            return
        }
        _creationState.value = _creationState.value.copy(
            fields = _creationState.value.fields.filter { it.id != fieldId }
        )
    }

    fun updateField(fieldId: String, update: FieldUpdate) {
        _creationState.value = _creationState.value.copy(
            fields = _creationState.value.fields.map { field ->
                if (field.id == fieldId) {
                    when (update) {
                        is FieldUpdate.Label -> field.copy(label = update.value)
                        is FieldUpdate.Placeholder -> field.copy(placeholder = update.value)
                        is FieldUpdate.Content -> field.copy(content = update.value)
                        is FieldUpdate.Signature -> field.copy(userId = update.userId, placeholder = update.placeholder)
                    }
                } else {
                    field
                }
            }
        )
    }

    fun createNote(workspaceId: String) {
        viewModelScope.launch {
            createNoteInternal(workspaceId)
        }
    }

    private suspend fun createNoteInternal(workspaceId: String) {
        Log.d("NoteCreation", "Creating note with workspaceId: '$workspaceId'")

        _creationState.value = _creationState.value.copy(
            isCreating = true,
            error = null
        )

        val actualWorkspaceId = resolveWorkspaceId(workspaceId) ?: return
        val validationError = validateFields()
        if (validationError != null) {
            _creationState.value = _creationState.value.copy(
                isCreating = false,
                error = validationError
            )
            return
        }

        val userId = getCurrentUserId() ?: return
        val fields = convertFieldsToDto()

        createNoteRequest(actualWorkspaceId, userId, fields)
    }

    private suspend fun resolveWorkspaceId(workspaceId: String): String? {
        if (workspaceId.isNotBlank()) {
            return workspaceId
        }
        val personalWorkspace = workspaceRepository.getPersonalWorkspace()
        return if (personalWorkspace.isSuccess) {
            personalWorkspace.getOrNull()?._id
        } else {
            _creationState.value = _creationState.value.copy(
                isCreating = false,
                error = "Failed to get personal workspace"
            )
            null
        }
    }

    private fun validateFields(): String? {
        val titleField = _creationState.value.fields.firstOrNull()
        if (titleField == null || (titleField.content as? String).isNullOrBlank()) {
            return "Please enter a title"
        }

        /* default title field is always created, therefore size always minimum 1 */
        if (_creationState.value.fields.size < 2) {
            return "Please add at least one field"
        }
        if (_creationState.value.tags.isEmpty()){
            return "Please add at least one tag"
        }
        val hasEmptyLabel = _creationState.value.fields.any { it.label.isBlank() }
        if (hasEmptyLabel) {
            return "All fields must have a label"
        }
        return null
    }

    private suspend fun getCurrentUserId(): String? {
        val user = authRepository.getCurrentUser()
        return user?._id ?: run {
            _creationState.value = _creationState.value.copy(
                isCreating = false,
                error = "User not authenticated"
            )
            null
        }
    }

    private fun convertFieldsToDto(): List<Field> {
        return _creationState.value.fields.map { fieldData ->
            when (fieldData.type) {
                FieldType.TEXT -> TextField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    placeholder = fieldData.placeholder,
                    content = when (fieldData.content) {
                        is String -> fieldData.content
                        else -> fieldData.content?.toString()
                    }
                )

                FieldType.DATETIME -> DateTimeField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    content = when (fieldData.content) {
                        is LocalDateTime -> fieldData.content
                        is String -> try { LocalDateTime.parse(fieldData.content) } catch (e: java.time.format.DateTimeParseException) { null }
                        else -> null
                    }
                )

                FieldType.SIGNATURE -> SignatureField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    userId = fieldData.userId,
                    userName = fieldData.placeholder
                )
            }
        }
    }

    private suspend fun createNoteRequest(workspaceId: String, userId: String, fields: List<Field>) {
        val tags = _creationState.value.tags
        val result = noteRepository.createNote(
            workspaceId = workspaceId,
            authorId = userId,
            tags = tags,
            fields = fields,
            noteType = _creationState.value.noteType
        )

        result.fold(
            onSuccess = {
                _creationState.value = _creationState.value.copy(
                    isCreating = false,
                    isSuccess = true,
                    error = null
                )
                //We need to update the tag selection so that the created note shows on the screen we load
                val newSelectedTags = navigationStateManager.state.getSelectedTags().union(tags).toList()
                navigationStateManager.state.updateTagSelection(newSelectedTags, navigationStateManager.state.getAllTagsSelected())
            },
            onFailure = { exception ->
                _creationState.value = _creationState.value.copy(
                    isCreating = false,
                    error = exception.message ?: "Failed to create note"
                )
            }
        )
    }

    fun reset(noteType: NoteType, noteId: String?) {
        _creationState.value = NoteCreationState()
        viewModelScope.launch{
            _creationState.value = _creationState.value.copy(isLoadingTemplate = true)
            getProfile() //loading profile to read the signatures correctly
            setFieldsToTemplate(noteId)

            // initialize with title field if no template loaded
            // TODO: make sure title will always exist even with template load
            if (_creationState.value.fields.isEmpty()) {
                val titleField = FieldCreationData(
                    type = FieldType.TEXT,
                    label = "Title",
                    placeholder = "Enter title"
                )
                _creationState.value = _creationState.value.copy(
                    fields = listOf(titleField)
                )
            }
            setNoteType(noteType)
            _creationState.value = _creationState.value.copy(isLoadingTemplate = false)
        }
    }

    private suspend fun getProfile(){
        val user = profileRepository.getProfile().getOrNull() //if cannot get user will be null, if it is null, cannot sign in the screen
        _creationState.value = _creationState.value.copy(user = user)
    }
}