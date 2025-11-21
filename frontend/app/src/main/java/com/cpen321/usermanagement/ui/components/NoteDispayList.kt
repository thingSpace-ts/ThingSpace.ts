package com.cpen321.usermanagement.ui.components

import androidx.compose.runtime.Composable
import Button
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.Note
import com.cpen321.usermanagement.data.remote.dto.TextField
import com.cpen321.usermanagement.data.remote.dto.DateTimeField
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.ui.theme.LocalFontSizes
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.data.remote.dto.Field
import com.cpen321.usermanagement.data.remote.dto.TitleField

@Composable
private fun getFieldPreview(field: Field): String {
    return when (field) {
        is TextField -> field.content?.takeIf { it.isNotEmpty() } 
            ?: field.label.ifEmpty { stringResource(R.string.empty_note) }
        is DateTimeField -> field.content?.toString() 
            ?: field.label.ifEmpty { stringResource(R.string.empty_note) }
        else -> stringResource(R.string.empty_note)
    }
}

@Composable
fun NoteDisplayList(
    onNoteClick: (String)->Unit,
    notes: List<Note>,
    modifier: Modifier = Modifier
){
    val spacing = LocalSpacing.current
    
    for(note in notes){
        val titleField = note.fields.find {
            it is TitleField
        } as? TitleField
        val notePreview = titleField?.content?.takeIf { it.isNotEmpty() }
            ?: stringResource(R.string.empty_note_title)
        
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = spacing.medium, vertical = spacing.small)
                .clickable { onNoteClick(note._id) },
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            ),
            elevation = CardDefaults.cardElevation(
                defaultElevation = spacing.extraSmall
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(spacing.medium)
            ) {
                Text(
                    text = notePreview,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = modifier
                )
            }
        }
    }
}

@Composable
fun TemplateDisplayList(
    onTitleClick: (String)->Unit, //the input is noteId
    onEditClick: (String)->Unit,
    templates: List<Note>,
    modifier: Modifier = Modifier
){
    for(template in templates){
        val templatePreview = template.fields.firstOrNull()?.let { getFieldPreview(it) }
            ?: stringResource(R.string.empty_note)

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
            modifier = modifier
        ){
            TemplateRow(
                title = templatePreview,
                onTitleClick = { onTitleClick(template._id) },
                onEditClick = { onEditClick(template._id) }
            )
        }

    }
}