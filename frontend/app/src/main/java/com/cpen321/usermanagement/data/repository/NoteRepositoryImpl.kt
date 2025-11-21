package com.cpen321.usermanagement.data.repository

import android.util.Log
import com.cpen321.usermanagement.data.local.preferences.TokenManager
import com.cpen321.usermanagement.data.remote.api.CopyNoteRequest
import com.cpen321.usermanagement.data.remote.api.NoteInterface
import com.cpen321.usermanagement.data.remote.api.ShareNoteRequest
import com.cpen321.usermanagement.data.remote.dto.*
import com.cpen321.usermanagement.utils.JsonUtils.parseErrorMessage
import jakarta.inject.Inject
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import com.cpen321.usermanagement.data.remote.dto.Field
import kotlin.reflect.typeOf

class NoteRepositoryImpl @Inject constructor(
    private val noteApi: NoteInterface,
    private val tokenManager: TokenManager
) : NoteRepository {

    companion object {
        private const val TAG = "NoteRepository"
        private const val AUTH_HEADER_PLACEHOLDER = "" // Handled by Interceptor
    }

    private fun convertToBackendFields(fields: List<Field>): List<Map<String, Any?>> {
        return fields.map { field ->
            when (field) {
                is TitleField -> mapOf(
                    "_id" to field._id,
                    "fieldType" to "title",
                    "label" to field.label,
                    "required" to field.required,
                    "content" to field.content
                )
                is TextField -> mapOf(
                    "_id" to field._id,
                    "fieldType" to "text",
                    "label" to field.label,
                    "required" to field.required,
                    "placeholder" to field.placeholder,
                    "content" to field.content
                )
                is DateTimeField -> mapOf(
                    "_id" to field._id,
                    "fieldType" to "datetime",
                    "label" to field.label,
                    "required" to field.required,
                    "content" to field.content?.toString()
                )
            }
        }
    }

    override suspend fun getNote(noteId: String): Result<Note> {
        return try {
            val response = noteApi.getNote(AUTH_HEADER_PLACEHOLDER, noteId)
            if (response.isSuccessful && response.body()?.data != null) {
                Result.success(response.body()!!.data!!.note)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to fetch note."
                )
                Log.e(TAG, "getNote error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("getNote", e) }
        catch (e: UnknownHostException) { return handleException("getNote", e) }
        catch (e: IOException) { return handleException("getNote", e) }
    }

    override suspend fun createNote(
        workspaceId: String,
        authorId: String,
        tags: List<String>,
        fields: List<Field>,
        noteType: NoteType
    ): Result<Unit> {
        return try {
            // Transform fields to backend format with proper field types
            val backendFields = convertToBackendFields(fields)

            val requestMap = mapOf(
                "workspaceId" to workspaceId,
                "fields" to backendFields,
                "tags" to tags,
                "noteType" to noteType.name
            )

            val response = noteApi.createNote(AUTH_HEADER_PLACEHOLDER, requestMap)

            if (response.isSuccessful) {
                Log.d(TAG, "Note created successfully")
                Result.success(Unit)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to create note."
                )
                Log.e(TAG, "createNote error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("createNote", e) }
        catch (e: UnknownHostException) { return handleException("createNote", e) }
        catch (e: IOException) { return handleException("createNote", e) }
    }

    override suspend fun updateNote(
        noteId: String,
        tags: List<String>,
        fields: List<Field>
    ): Result<Unit> {
        return try {
            // Transform fields to backend format with proper field types
            val backendFields = convertToBackendFields(fields)

            val requestMap = mapOf(
                "fields" to backendFields,
                "tags" to tags
            )

            val response = noteApi.updateNote(AUTH_HEADER_PLACEHOLDER, noteId, requestMap)

            if (response.isSuccessful) {
                Log.d(TAG, "Note updated successfully")
                Result.success(Unit)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to update note."
                )
                Log.e(TAG, "updateNote error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("updateNote", e) }
        catch (e: UnknownHostException) { return handleException("updateNote", e) }
        catch (e: IOException) { return handleException("updateNote", e) }
    }

    override suspend fun deleteNote(noteId: String): Result<Unit> {
        return try {
            val response = noteApi.deleteNote("", noteId)

            if (response.isSuccessful) {
                Log.d(TAG, "Note deleted successfully")
                Result.success(Unit)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to delete note."
                )
                Log.e(TAG, "deleteNote error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("deleteNote", e) }
        catch (e: UnknownHostException) { return handleException("deleteNote", e) }
        catch (e: IOException) { return handleException("deleteNote", e) }
    }

    override suspend fun findNotes(
        workspaceId: String,
        noteType: NoteType,
        tagsToInclude: List<String>,
        searchQuery: String,
        notesPerPage: Int
    ): Result<List<Note>> {
        return try {
            val response = noteApi.findNotes(
                authHeader = AUTH_HEADER_PLACEHOLDER,
                workspaceId = workspaceId,
                noteType = noteType.name,
                tags = tagsToInclude,
                query = searchQuery
            )

            if (response.isSuccessful && response.body()?.data != null) {
                Log.d(TAG, "Notes fetched successfully")
                Result.success(response.body()!!.data!!.notes)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to fetch notes."
                )
                Log.e(TAG, "findNotes error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("findNotes", e) }
        catch (e: UnknownHostException) { return handleException("findNotes", e) }
        catch (e: IOException) { return handleException("findNotes", e) }
    }

    override suspend fun getAuthors(noteIds: List<String>): Result<List<User>> {
        // TODO: Implement when backend endpoint is ready
        return Result.success(emptyList())
    }

    override suspend fun getWorkspacesForNote(noteId: String): Result<Workspace> {
        // TODO: Implement when backend endpoint is ready
        return Result.success(Workspace("", Profile("", "", "")))
    }

    override suspend fun shareNoteToWorkspace(noteId: String, workspaceId: String): Result<Unit> {
        return try {
            val request = ShareNoteRequest(workspaceId)
            val response = noteApi.shareNoteToWorkspace(AUTH_HEADER_PLACEHOLDER, noteId, request)
            if (response.isSuccessful) {
                Log.d(TAG, "Note shared successfully to workspace $workspaceId")
                Result.success(Unit)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to share note."
                )
                Log.e(TAG, "shareNoteToWorkspace error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("shareNoteToWorkspace", e) }
        catch (e: UnknownHostException) { return handleException("shareNoteToWorkspace", e) }
        catch (e: IOException) { return handleException("shareNoteToWorkspace", e) }
    }

    override suspend fun copyNoteToWorkspace(noteId: String, workspaceId: String): Result<Unit> {
        return try {
            val request = CopyNoteRequest(workspaceId)
            val response = noteApi.copyNoteToWorkspace(AUTH_HEADER_PLACEHOLDER, noteId, request)
            if (response.isSuccessful) {
                Log.d(TAG, "Note copied successfully to workspace $workspaceId")
                Result.success(Unit)
            } else {
                val errorMessage = parseErrorMessage(
                    response.errorBody()?.string(),
                    "Failed to copy note."
                )
                Log.e(TAG, "copyNoteToWorkspace error: $errorMessage")
                Result.failure(Exception(errorMessage))
            }
        } catch (e: SocketTimeoutException) { return handleException("copyNoteToWorkspace", e) }
        catch (e: UnknownHostException) { return handleException("copyNoteToWorkspace", e) }
        catch (e: IOException) { return handleException("copyNoteToWorkspace", e) }
    }

    private fun <T> handleException(method: String, e: Exception): Result<T> {
        val errorMessage = when (e) {
            is UnknownHostException, is SocketTimeoutException ->
                "Network connection error. Please check your internet."
            is IOException ->
                "Network error. Please try again."
            else -> e.message ?: "An unexpected error occurred."
        }
        Log.e(TAG, "$method failed", e)
        return Result.failure(Exception(errorMessage))
    }
}