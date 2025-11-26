package com.cpen321.usermanagement.ui.viewmodels

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cpen321.usermanagement.data.remote.dto.*
import com.cpen321.usermanagement.data.repository.NoteRepository
import com.cpen321.usermanagement.data.repository.ProfileRepository
import com.cpen321.usermanagement.data.repository.WorkspaceRepository
import com.cpen321.usermanagement.ui.navigation.NavigationStateManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import javax.inject.Inject

data class NoteEditState(
    val noteType: NoteType = NoteType.CONTENT,
    val tags: List<String> = emptyList(),
    val fields: List<FieldCreationData> = emptyList(),
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val error: String? = null,
    val loadError: String? = null,
    val isSuccess: Boolean = false,
    val isSharing: Boolean = false,
    val isCopying: Boolean = false,
    val shareSuccess: Boolean = false,
    val copySuccess: Boolean = false,
    val workspaces: List<Workspace> = emptyList(),
    val isLoadingWorkspaces: Boolean = false,
    val lastEditString: String = "",
    val createdAtString: String = "",
    val isDeleting: Boolean = false,
    val isDeleted: Boolean = false,
    val user: User? = null
)

@HiltViewModel
class NoteEditViewModel @Inject constructor(
    private val noteRepository: NoteRepository,
    private val workspaceRepository: WorkspaceRepository,
    private val profileRepository: ProfileRepository,
) : ViewModel() {

    private val _editState = MutableStateFlow(NoteEditState())
    val editState: StateFlow<NoteEditState> = _editState.asStateFlow()

    fun loadWorkspaces() {
        viewModelScope.launch {
            _editState.value = _editState.value.copy(isLoadingWorkspaces = true)

            var workspacesToDisplay = emptyList<Workspace>()
            val personalResult = workspaceRepository.getPersonalWorkspace()
            personalResult.fold(
                onSuccess = {workspace -> workspacesToDisplay+=listOf(workspace)},
                onFailure = {_editState.value = _editState.value.copy(
                    isLoadingWorkspaces = false,
                    error = "Failed to load personal workspace!",
                )}
            )

            val result = workspaceRepository.getWorkspacesForUser()

            result.fold(
                onSuccess = { workspaces ->
                    _editState.value = _editState.value.copy(
                        workspaces = workspaces+workspacesToDisplay,
                        isLoadingWorkspaces = false
                    )
                },
                onFailure = { exception ->
                    _editState.value = _editState.value.copy(
                        isLoadingWorkspaces = false,
                        error = "Failed to load workspaces: ${exception.message}"
                    )
                }
            )

        }
    }

    private fun loadFieldCreationData(note:Note):List<FieldCreationData>{
        val fieldCreationData = note.fields.map { field ->
            when (field) {
                is TextField -> FieldCreationData(
                    id = field._id,
                    type = FieldType.TEXT,
                    label = field.label,
                    placeholder = field.placeholder,
                    content = field.content
                )
                is DateTimeField -> FieldCreationData(
                    id = field._id,
                    type = FieldType.DATETIME,
                    label = field.label,
                    content = field.content
                )
                is SignatureField -> FieldCreationData(
                    id = field._id,
                    type = FieldType.SIGNATURE,
                    label = field.label,
                    userId = field.userId,
                    placeholder = field.userName
                )
            }
        }

        // Ensure title field exists as first field
        val finalFields = if (fieldCreationData.isEmpty() || fieldCreationData.first().label != "Title") {
            listOf(
                FieldCreationData(
                    type = FieldType.TEXT,
                    label = "Title",
                    placeholder = "Enter title"
                )
            ) + fieldCreationData
        } else fieldCreationData

        return finalFields
    }

    fun loadNote(noteId: String) {
        viewModelScope.launch {
            _editState.value = _editState.value.copy(isLoading = true, loadError = null)

            val result = noteRepository.getNote(noteId)
            // loading profile to interpret signature fields
            val user = profileRepository.getProfile().getOrNull() //if cannot get user will be null, if it is null, cannot sign the signature

            result.fold(
                onSuccess = { note ->
                    val finalFields = loadFieldCreationData(note)

                    _editState.value = NoteEditState(
                        noteType = note.noteType,
                        tags = note.tags,
                        fields = finalFields,
                        workspaces = _editState.value.workspaces,
                        isLoading = false,
                        loadError = null,
                        createdAtString = note.createdAt,
                        lastEditString = note.updatedAt,
                        user = user
                    )
                },
                onFailure = { exception ->
                    _editState.value = _editState.value.copy(
                        isLoading = false,
                        user = user,
                        loadError = exception.message ?: "Failed to load note"
                    )
                }
            )
        }
    }

    fun addTag(tag: String) {
        if (tag.isNotBlank() && !_editState.value.tags.contains(tag)) {
            _editState.value = _editState.value.copy(
                tags = _editState.value.tags + tag
            )
        }
    }

    fun removeTag(tag: String) {
        _editState.value = _editState.value.copy(
            tags = _editState.value.tags.filter { it != tag }
        )
    }

    fun addField(type: FieldType) {
        val newField = FieldCreationData(
            type = type,
            label = when (type) {
                FieldType.TEXT -> "New Text Field"
                FieldType.DATETIME -> "New DateTime Field"
                FieldType.SIGNATURE -> "New Signature Field"
            }
        )
        _editState.value = _editState.value.copy(
            fields = _editState.value.fields + newField
        )
    }

    fun removeField(fieldId: String) {
        // Don't allow removing the first field (title)
        val fields = _editState.value.fields
        if (fields.isNotEmpty() && fields.first().id == fieldId) {
            return
        }
        _editState.value = _editState.value.copy(
            fields = _editState.value.fields.filter { it.id != fieldId }
        )
    }

    fun updateField(fieldId: String, update: FieldUpdate) {
        _editState.value = _editState.value.copy(
            fields = _editState.value.fields.map { field ->
                if (field.id == fieldId) {
                    when (update) {
                        is FieldUpdate.Label -> field.copy(label = update.value)
                        is FieldUpdate.Placeholder -> field.copy(placeholder = update.value)
                        is FieldUpdate.Content -> field.copy(content = update.value)
                        is FieldUpdate.Signature -> field.copy(placeholder = update.placeholder, userId = update.userId)
                    }
                } else field
            }
        )
    }

    fun saveNote(noteId: String) {
        viewModelScope.launch {
            val validationError = validateFields()
            if (validationError == null) {
                _editState.value = _editState.value.copy(isSaving = true, error = null)
                val fields = convertFieldsToDto()
                updateNoteRequest(noteId, fields)
            } else {
                _editState.value = _editState.value.copy(error = validationError)
            }
        }
    }

    private fun validateFields(): String? {
        val titleField = _editState.value.fields.firstOrNull()
        if (titleField == null || (titleField.content as? String).isNullOrBlank()) {
            return "Please enter a title"
        }
        return null
    }

    private fun convertFieldsToDto(): List<Field> {
        return _editState.value.fields.map { fieldData ->
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

    private suspend fun updateNoteRequest(noteId: String, fields: List<Field>) {
        val result = noteRepository.updateNote(
            noteId = noteId,
            tags = _editState.value.tags,
            fields = fields
        )

        result.fold(
            onSuccess = {
                _editState.value = _editState.value.copy(
                    isSaving = false,
                    isSuccess = true,
                    error = null
                )
            },
            onFailure = { exception ->
                _editState.value = _editState.value.copy(
                    isSaving = false,
                    error = exception.message ?: "Failed to save note"
                )
            }
        )
    }

    fun shareNote(noteId: String, workspaceId: String) {
        viewModelScope.launch {
            _editState.value = _editState.value.copy(isSharing = true, error = null)

            val result = noteRepository.shareNoteToWorkspace(noteId, workspaceId)

            result.fold(
                onSuccess = {
                    _editState.value = _editState.value.copy(
                        isSharing = false,
                        shareSuccess = true,
                        error = null
                    )
                },
                onFailure = { exception ->
                    _editState.value = _editState.value.copy(
                        isSharing = false,
                        error = exception.message ?: "Failed to share note"
                    )
                }
            )
        }
    }

    fun copyNote(noteId: String, workspaceId: String) {
        viewModelScope.launch {
            _editState.value = _editState.value.copy(isCopying = true, error = null)

            val result = noteRepository.copyNoteToWorkspace(noteId, workspaceId)

            result.fold(
                onSuccess = {
                    _editState.value = _editState.value.copy(
                        isCopying = false,
                        copySuccess = true,
                        error = null
                    )
                },
                onFailure = { exception ->
                    _editState.value = _editState.value.copy(
                        isCopying = false,
                        error = exception.message ?: "Failed to copy note"
                    )
                }
            )
        }
    }

    fun resetActionStates() {
        _editState.value = _editState.value.copy(
            shareSuccess = false,
            copySuccess = false,
            isDeleted = false,
            isSuccess = false,
            error = null
        )
    }

    fun deleteNote(noteId: String) {
        viewModelScope.launch {
            _editState.value = _editState.value.copy(isDeleting = true, error = null)

            val result = noteRepository.deleteNote(noteId)

            result.fold(
                onSuccess = {
                    _editState.value = _editState.value.copy(
                        isDeleting = false,
                        isDeleted = true,
                        error = null
                    )
                },
                onFailure = { exception ->
                    _editState.value = _editState.value.copy(
                        isDeleting = false,
                        error = exception.message ?: "Failed to delete note"
                    )
                }
            )
        }
    }

    fun reset() {
        _editState.value = NoteEditState()
    }
}