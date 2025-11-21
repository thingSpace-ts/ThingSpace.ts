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
import com.cpen321.usermanagement.ui.components.FieldTypeDialog

enum class FieldType {
    TEXT,
    TITLE,
    DATETIME
}

data class FieldCreationData(
    val id: String = UUID.randomUUID().toString(),
    val type: FieldType,
    val label: String = "",
    val required: Boolean = false,
    val placeholder: String? = null,
    val content: Any? = null
)

sealed class FieldUpdate {
    data class Label(val value: String) : FieldUpdate()
    data class Required(val value: Boolean) : FieldUpdate()
    data class Placeholder(val value: String) : FieldUpdate()
    data class Content(val value: Any?) : FieldUpdate()
}

data class NoteCreationState(
    val noteType: NoteType = NoteType.CONTENT,
    val tags: List<String> = emptyList(),
    val fields: List<FieldCreationData> = emptyList(),
    val isCreating: Boolean = false,
    val error: String? = null,
    val isSuccess: Boolean = false,
    val isLoadingTemplate: Boolean = false,
)

@HiltViewModel
class NoteCreationViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val noteRepository: NoteRepository,
    private val workspaceRepository: WorkspaceRepository,
    private val navigationStateManager: NavigationStateManager
) : ViewModel() {


    private val _creationState = MutableStateFlow(NoteCreationState())
    val creationState: StateFlow<NoteCreationState> = _creationState.asStateFlow()

    init {
        val titleField = FieldCreationData(
            type = FieldType.TITLE,
            label = "Title",
            required = true
        )
        _creationState.value = _creationState.value.copy(
            fields = listOf(titleField)
        )
    }

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

    fun setFieldsToTemplate(noteId:String?)
    {
        if (noteId!=null) viewModelScope.launch{
            _creationState.value = _creationState.value.copy(isLoadingTemplate = true)
            val noteRequest = noteRepository.getNote(noteId)
            if (noteRequest.isSuccess){
                val note = noteRequest.getOrNull()!!
                val fields = mutableListOf<FieldCreationData>()
                for (field in note.fields){
                    val fieldType = when(field) {
                        is TextField -> {
                            FieldType.TEXT
                        }
                        is DateTimeField -> {
                            FieldType.DATETIME
                        }
                    }
                    fields.add(FieldCreationData(type = fieldType, label = field.label))
                }
                //Also sets tags as they are part of template content
                _creationState.value = _creationState.value.copy(fields = fields, tags = note.tags, isLoadingTemplate = false)
            }
        }
    }

    fun removeField(fieldId: String) {
        _creationState.value = _creationState.value.copy(
            fields = _creationState.value.fields.filter {
                it.id != fieldId && it.type != FieldType.TITLE
            }
        )
    }

    fun updateField(fieldId: String, update: FieldUpdate) {
        _creationState.value = _creationState.value.copy(
            fields = _creationState.value.fields.map { field ->
                if (field.id == fieldId) {
                    when (update) {
                        is FieldUpdate.Label -> field.copy(label = update.value)
                        is FieldUpdate.Required -> field.copy(required = update.value)
                        is FieldUpdate.Placeholder -> field.copy(placeholder = update.value)
                        is FieldUpdate.Content -> field.copy(content = update.value)
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
        if (_creationState.value.fields.isEmpty()) {
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
                FieldType.TITLE -> TitleField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    required = fieldData.required,
                    content = fieldData.content as? String
                )

                FieldType.TEXT -> TextField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    required = fieldData.required,
                    placeholder = fieldData.placeholder,
                    content = when (fieldData.content) {
                        is String -> fieldData.content
                        else -> fieldData.content?.toString()
                    }
                )

                FieldType.DATETIME -> DateTimeField(
                    _id = fieldData.id,
                    label = fieldData.label,
                    required = fieldData.required,
                    content = when (fieldData.content) {
                        is LocalDateTime -> fieldData.content
                        is String -> try { LocalDateTime.parse(fieldData.content) } catch (e: java.time.format.DateTimeParseException) { null }
                        else -> null
                    }
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

    fun reset() {
        _creationState.value = NoteCreationState()
    }
}