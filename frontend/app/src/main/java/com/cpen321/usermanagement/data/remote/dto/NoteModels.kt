package com.cpen321.usermanagement.data.remote.dto
import com.google.gson.annotations.SerializedName
import com.google.gson.annotations.JsonAdapter
import com.google.gson.*
import java.time.LocalDateTime
import java.lang.reflect.Type

/*
 * Note and Field data classes
 */

data class Note(
    @SerializedName("_id")
    val _id: String,
    @SerializedName("createdAt")
    val createdAt: String,
    @SerializedName("updatedAt")
    val updatedAt: String,
    val tags: List<String> = emptyList(),
    val noteType: NoteType,
    val fields: List<Field> = emptyList(),
)

// Field Types implemented here:
@JsonAdapter(FieldDeserializer::class)
sealed class Field {
    abstract val _id: String
    abstract val label: String
    abstract val required: Boolean
}

// TextField, DateTimeField extend the Field interface
// ? = null makes some parts nullable (can be empty)
data class TitleField(
    override val _id: String,
    override val label: String = "Title",
    override val required: Boolean = true,
    val content: String? = null
) : Field()

data class TextField(
    override val _id: String,
    override val label: String,
    override val required: Boolean = false,
    val placeholder: String? = null,
    val content: String? = null
) : Field()

data class DateTimeField(
    override val _id: String,
    override val label: String,
    override val required: Boolean = false,
    val content: LocalDateTime? = null
) : Field()

// TODO: ADD MORE ENUMS FOR NOTETYPE LATER
enum class NoteType {
    CONTENT,
    CHAT,
    TEMPLATE
}

/**
 * Custom Gson deserializer for Field sealed class
 * Uses fieldType discriminator to determine which concrete class to deserialize to
 */
class FieldDeserializer : JsonDeserializer<Field> {
    override fun deserialize(
        json: JsonElement,
        typeOfT: Type,
        context: JsonDeserializationContext
    ): Field {
        val jsonObject = json.asJsonObject
        val fieldType = jsonObject.get("fieldType")?.asString
        
        // Remove fieldType from JSON before deserializing to avoid property conflicts
        val cleanJson = jsonObject.deepCopy()
        cleanJson.remove("fieldType")
        
        return when (fieldType) {
            "title" -> context.deserialize(cleanJson, TitleField::class.java)
            "text" -> context.deserialize(cleanJson, TextField::class.java)
            "datetime" -> {
                // Convert string dates to LocalDateTime objects and create DateTimeField directly
                val minDate = jsonObject.get("minDate")?.asString?.let { LocalDateTime.parse(it) }
                val maxDate = jsonObject.get("maxDate")?.asString?.let { LocalDateTime.parse(it) }
                val content = jsonObject.get("content")?.asString?.let { LocalDateTime.parse(it) }

                DateTimeField(
                    _id = jsonObject.get("_id")?.asString ?: "",
                    label = jsonObject.get("label")?.asString ?: "",
                    required = jsonObject.get("required")?.asBoolean ?: false,
                    content = content
                )
            }
            null -> {
                // Handle missing fieldType - default to TextField for backward compatibility
                // This ensures existing data without fieldType still works
                context.deserialize(cleanJson, TextField::class.java)
            }
            else -> {
                // Handle unknown field types - default to TextField to prevent crashes
                // Log a warning in production
                context.deserialize(cleanJson, TextField::class.java)
            }
        }
    }
}