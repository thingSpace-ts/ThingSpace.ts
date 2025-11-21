package com.cpen321.usermanagement.ui.screens

import Button
import Icon
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.*
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.viewmodels.FieldCreationData
import com.cpen321.usermanagement.ui.viewmodels.FieldType
import com.cpen321.usermanagement.ui.viewmodels.FieldUpdate
import com.cpen321.usermanagement.ui.viewmodels.NoteCreationState
import com.cpen321.usermanagement.ui.viewmodels.NoteCreationViewModel
import com.cpen321.usermanagement.utils.FeatureActions

data class NoteCreationCallbacks(
    val onBackClick: () -> Unit,
    val onTagAdded: (String) -> Unit,
    val onTagRemoved: (String) -> Unit,
    val onFieldAdded: (FieldType) -> Unit,
    val onFieldRemoved: (String) -> Unit,
    val onFieldUpdated: (String, FieldUpdate) -> Unit,
    val onCreateNote: () -> Unit
)

@Composable
fun NoteCreationScreen(
    noteCreationViewModel: NoteCreationViewModel,
    onBackClick: () -> Unit,
    featureActions: FeatureActions
) {
    val creationState by noteCreationViewModel.creationState.collectAsState()

    LaunchedEffect(creationState.isSuccess) {
        if (creationState.isSuccess) {
            onBackClick()
            if (creationState.noteType == NoteType.CONTENT){
                featureActions.navs.navigateToMainWithContext(
                    workspaceId = featureActions.state.getWorkspaceId(),
                    searchQuery = featureActions.state.getSearchQuery(),
                    selectedTags = featureActions.state.getSelectedTags(),
                    allTagsSelected = featureActions.state.getAllTagsSelected())
            }
            else{
                featureActions.navs.navigateToTemplate(
                    workspaceId = featureActions.state.getWorkspaceId(),
                    searchQuery = featureActions.state.getSearchQuery(),
                    selectedTags = featureActions.state.getSelectedTags(),
                    allTagsSelected = featureActions.state.getAllTagsSelected())
            }
        }
    }

    if(creationState.isLoadingTemplate) CircularProgressIndicator(
        modifier = Modifier.size(LocalSpacing.current.medium),
        color = MaterialTheme.colorScheme.onPrimary
    )
    else NoteCreationContent(
        creationState = creationState,
        callbacks = NoteCreationCallbacks(
            onBackClick = onBackClick,
            onTagAdded = noteCreationViewModel::addTag,
            onTagRemoved = noteCreationViewModel::removeTag,
            onFieldAdded = noteCreationViewModel::addField,
            onFieldRemoved = noteCreationViewModel::removeField,
            onFieldUpdated = noteCreationViewModel::updateField,
            onCreateNote = { noteCreationViewModel.createNote(featureActions.state.getWorkspaceId()) }
        )
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteCreationContent(
    creationState: NoteCreationState,
    callbacks: NoteCreationCallbacks,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = { NoteCreationTopBar(onBackClick = callbacks.onBackClick) },
        bottomBar = { NoteCreationBottomBar(
            onBackClick = callbacks.onBackClick,
            onCreateNote = callbacks.onCreateNote,
            isCreating = creationState.isCreating
        ) }
    ) { paddingValues ->
        NoteCreationBody(
            creationState = creationState,
            paddingValues = paddingValues,
            callbacks = callbacks
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NoteCreationTopBar(onBackClick: () -> Unit) {
    TopAppBar(
        title = {
            Text(
                text = stringResource(R.string.create_note),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(name = R.drawable.ic_arrow_back)
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun NoteCreationBottomBar(
    onBackClick: () -> Unit,
    onCreateNote: () -> Unit,
    isCreating: Boolean
) {
    val spacing = LocalSpacing.current
    
    BottomAppBar(
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = spacing.medium),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            Button(
                onClick = onBackClick,
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Text(stringResource(R.string.cancel))
            }
            Spacer(modifier = Modifier.width(spacing.medium))
            Button(
                onClick = onCreateNote,
                modifier = Modifier.weight(1f),
                enabled = !isCreating
            ) {
                if (isCreating) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(spacing.medium),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text(stringResource(R.string.create))
                }
            }
        }
    }
}

@Composable
fun NoteCreationBody(
    creationState: NoteCreationState,
    paddingValues: PaddingValues,
    callbacks: NoteCreationCallbacks,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(paddingValues)
            .padding(spacing.medium)
            .verticalScroll(scrollState)
    ) {
        // Error message
        if (creationState.error != null) {
            Card(
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = creationState.error,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(spacing.medium)
                )
            }
            Spacer(modifier = Modifier.height(spacing.medium))
        }

        // Note Type Selection
        NoteTypeSection(
            selectedType = creationState.noteType,
        )

        Spacer(modifier = Modifier.height(spacing.large))

        // Tags Input Section
        TagsInputSection(
            tags = creationState.tags,
            onTagAdded = callbacks.onTagAdded,
            onTagRemoved = callbacks.onTagRemoved
        )

        Spacer(modifier = Modifier.height(spacing.large))

        // Title Section
        TitleInputSection(
            fields = creationState.fields,
            onFieldUpdated = callbacks.onFieldUpdated
        )

        Spacer(modifier = Modifier.height(spacing.large))
        // Fields Section
        FieldsSection(
            fields = creationState.fields,
            noteType = creationState.noteType,
            onFieldAdded = callbacks.onFieldAdded,
            onFieldRemoved = callbacks.onFieldRemoved,
            onFieldUpdated = callbacks.onFieldUpdated
        )
    }
}

@Composable
private fun NoteTypeSection(
    selectedType: NoteType,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.medium)
        ) {
            Text(
                text = stringResource(R.string.note_type),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(spacing.small))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(spacing.small)
            ) {
                NoteType.values().forEach { type ->
                    FilterChip(
                        selected = selectedType == type,
                        enabled = false,
                        onClick = { },
                        label = { Text(type.name) },
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}

@Composable
private fun TagsInputSection(
    tags: List<String>,
    onTagAdded: (String) -> Unit,
    onTagRemoved: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    var tagInput by remember { mutableStateOf("") }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.medium)
        ) {
            Text(
                text = stringResource(R.string.tags),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(spacing.small))

            TagInputField(
                tagInput = tagInput,
                onTagInputChange = { tagInput = it },
                onTagAdded = { tag ->
                    onTagAdded(tag)
                    tagInput = ""
                }
            )

            TagsList(tags = tags, onTagRemoved = onTagRemoved, spacing = spacing)
        }
    }
}

@Composable
private fun TagInputField(
    tagInput: String,
    onTagInputChange: (String) -> Unit,
    onTagAdded: (String) -> Unit
) {
    OutlinedTextField(
        value = tagInput,
        onValueChange = onTagInputChange,
        label = { Text(stringResource(R.string.add_tag)) },
        placeholder = { Text(stringResource(R.string.enter_tag_name)) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        trailingIcon = {
            IconButton(
                onClick = {
                    if (tagInput.isNotBlank()) {
                        onTagAdded(tagInput.trim())
                    }
                },
                enabled = tagInput.isNotBlank()
            ) {
                Text(
                    text = stringResource(R.string.add),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (tagInput.isNotBlank())
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    )
}

@Composable
private fun TagsList(
    tags: List<String>,
    onTagRemoved: (String) -> Unit,
    spacing: com.cpen321.usermanagement.ui.theme.Spacing
) {
    if (tags.isNotEmpty()) {
        Spacer(modifier = Modifier.height(spacing.small))
        androidx.compose.foundation.layout.FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.small),
            verticalArrangement = Arrangement.spacedBy(spacing.small)
        ) {
            tags.forEach { tag ->
                AssistChip(
                    onClick = { onTagRemoved(tag) },
                    label = { Text(tag) }
                )
            }
        }
    }
}

@Composable
private fun TitleInputSection(
    fields: List<FieldCreationData>,
    onFieldUpdated: (String, FieldUpdate) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    val titleField = fields.find { it.type == FieldType.TITLE }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.medium)
        ) {
            Text(
                text = "Title",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(spacing.small))

            if (titleField != null) {
                OutlinedTextField(
                    value = (titleField.content as? String) ?: "",
                    onValueChange = {
                        onFieldUpdated(titleField.id, FieldUpdate.Content(it))
                    },
                    label = { Text("Title:") },
                    placeholder = { Text("Enter note title...") },
                    modifier = Modifier.fillMaxWidth(),
                    isError = (titleField.content as? String).isNullOrBlank()
                )
            }
        }
    }
}

@Composable
private fun FieldsSection(
    fields: List<FieldCreationData>,
    noteType: NoteType,
    onFieldAdded: (FieldType) -> Unit,
    onFieldRemoved: (String) -> Unit,
    onFieldUpdated: (String, FieldUpdate) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    var showFieldTypeDialog by remember { mutableStateOf(false) }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.medium)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.fields),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Button(
                    onClick = { showFieldTypeDialog = true },
                    modifier = Modifier.height(spacing.extraLarge)
                ) {
                    Text(stringResource(R.string.add_field))
                }
            }

            Spacer(modifier = Modifier.height(spacing.medium))

            FieldsList(
                fields = fields,
                noteType = noteType,
                onFieldRemoved = onFieldRemoved,
                onFieldUpdated = onFieldUpdated,
                spacing = spacing
            )
        }
    }

    if (showFieldTypeDialog) {
        FieldTypeDialog(
            onDismiss = { showFieldTypeDialog = false },
            onTypeSelected = { type ->
                onFieldAdded(type)
                showFieldTypeDialog = false
            }
        )
    }
}

@Composable
private fun FieldsList(
    fields: List<FieldCreationData>,
    noteType: NoteType,
    onFieldRemoved: (String) -> Unit,
    onFieldUpdated: (String, FieldUpdate) -> Unit,
    spacing: com.cpen321.usermanagement.ui.theme.Spacing
) {
    if (fields.isEmpty()) {
        Text(
            text = stringResource(R.string.no_fields_added),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = spacing.medium)
        )
    } else {
        // prevents title field from showing in the all fields section
        fields.filter { it.type != FieldType.TITLE }.forEach { field ->
            FieldEditCard(
                field = field,
                noteType = noteType,
                onFieldRemoved = { onFieldRemoved(field.id) },
                onFieldUpdated = { update -> onFieldUpdated(field.id, update) }
            )
            Spacer(modifier = Modifier.height(spacing.small))
        }
    }
}

@Composable
private fun FieldEditCard(
    field: FieldCreationData,
    noteType: NoteType,
    onFieldRemoved: () -> Unit,
    onFieldUpdated: (FieldUpdate) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(spacing.medium)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = field.type.name,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary
                )
                IconButton(onClick = onFieldRemoved) {
                    Icon(name = R.drawable.ic_arrow_back)
                }
            }

            Spacer(modifier = Modifier.height(spacing.small))

            if (field.type != FieldType.TITLE) {
                OutlinedTextField(
                    value = field.label,
                    onValueChange = { onFieldUpdated(FieldUpdate.Label(it)) },
                    label = { Text(stringResource(R.string.label)) },
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(modifier = Modifier.height(spacing.small))

            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(
                    checked = field.required,
                    onCheckedChange = { onFieldUpdated(FieldUpdate.Required(it)) }
                )
                Text(stringResource(R.string.required))
            }

            FieldContentInputSection(
                field = field,
                noteType = noteType,
                onFieldUpdated = onFieldUpdated,
                spacing = spacing
            )

            FieldConfigurationSection(
                field = field,
                onFieldUpdated = onFieldUpdated,
                spacing = spacing
            )
        }
    }
}

@Composable
private fun FieldContentInputSection(
    field: FieldCreationData,
    noteType: NoteType,
    onFieldUpdated: (FieldUpdate) -> Unit,
    spacing: com.cpen321.usermanagement.ui.theme.Spacing
) {
    if (noteType != NoteType.TEMPLATE) {
        Spacer(modifier = Modifier.height(spacing.medium))
        Text(
            text = stringResource(R.string.field_content),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(spacing.small))
        
        when (field.type) {

            FieldType.TEXT -> TextFieldInput(field, onFieldUpdated)
            FieldType.DATETIME -> DateTimeFieldInput(field, onFieldUpdated, spacing)
        }
    }
}

@Composable
private fun TextFieldInput(
    field: FieldCreationData,
    onFieldUpdated: (FieldUpdate) -> Unit
) {
    OutlinedTextField(
        value = (field.content as? String) ?: "",
        onValueChange = { onFieldUpdated(FieldUpdate.Content(it)) },
        label = { Text(stringResource(R.string.text_content)) },
        placeholder = { Text(stringResource(R.string.enter_text_content)) },
        modifier = Modifier.fillMaxWidth(),
        minLines = 2,
        maxLines = 4
    )
}



@Composable
private fun DateTimeFieldInput(
    field: FieldCreationData,
    onFieldUpdated: (FieldUpdate) -> Unit,
    spacing: com.cpen321.usermanagement.ui.theme.Spacing
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    val currentDateTime = (field.content as? java.time.LocalDateTime) ?: java.time.LocalDateTime.now()
    
    Column {
        OutlinedTextField(
            value = currentDateTime.toString(),
            onValueChange = { 
                try {
                    val dateTime = java.time.LocalDateTime.parse(it)
                    onFieldUpdated(FieldUpdate.Content(dateTime))
                } catch (e: java.time.format.DateTimeParseException) {
                    // Invalid format, don't update
                }
            },
            label = { Text(stringResource(R.string.datetime_content)) },
            placeholder = { Text(stringResource(R.string.datetime_format)) },
            modifier = Modifier.fillMaxWidth(),
            readOnly = true
        )
        
        Spacer(modifier = Modifier.height(spacing.small))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(spacing.small)
        ) {
            Button(
                onClick = { showDatePicker = true },
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.pick_date))
            }
            Button(
                onClick = { showTimePicker = true },
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(R.string.pick_time))
            }
        }
    }
}

@Composable
private fun FieldConfigurationSection(
    field: FieldCreationData,
    onFieldUpdated: (FieldUpdate) -> Unit,
    spacing: com.cpen321.usermanagement.ui.theme.Spacing
) {
    Spacer(modifier = Modifier.height(spacing.medium))
    Text(
        text = stringResource(R.string.field_configuration),
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary
    )
    Spacer(modifier = Modifier.height(spacing.small))
    
    when (field.type) {

        FieldType.TEXT -> {
            OutlinedTextField(
                value = field.placeholder ?: "",
                onValueChange = { onFieldUpdated(FieldUpdate.Placeholder(it)) },
                label = { Text(stringResource(R.string.placeholder_optional)) },
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(spacing.small))
        }

        FieldType.DATETIME -> {
            Text(
                text = stringResource(R.string.datetime_config_coming_soon),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FieldTypeDialog(
    onDismiss: () -> Unit,
    onTypeSelected: (FieldType) -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_field_type)) },
        text = {
            Column {
                FieldType.values().forEach { type ->
                    TextButton(
                        onClick = { onTypeSelected(type) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = type.name,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        },
        modifier = modifier
    )
}