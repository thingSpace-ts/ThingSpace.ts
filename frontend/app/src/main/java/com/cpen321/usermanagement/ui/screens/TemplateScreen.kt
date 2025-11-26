package com.cpen321.usermanagement.ui.screens

import Button
import Icon
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.BottomAppBarDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.Note
import com.cpen321.usermanagement.data.remote.dto.NoteType
import com.cpen321.usermanagement.ui.components.MessageSnackbar
import com.cpen321.usermanagement.ui.components.MessageSnackbarState
import com.cpen321.usermanagement.ui.viewmodels.MainUiState
import com.cpen321.usermanagement.ui.viewmodels.TemplateViewModel
import com.cpen321.usermanagement.ui.theme.LocalFontSizes
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.components.MainBottomBar
import com.cpen321.usermanagement.ui.components.NoteDisplayList
import com.cpen321.usermanagement.ui.components.SearchBar
import com.cpen321.usermanagement.ui.components.TemplateBottomBar
import com.cpen321.usermanagement.ui.components.TemplateDisplayList
import com.cpen321.usermanagement.ui.viewmodels.CreateWsUiStateE
import com.cpen321.usermanagement.utils.FeatureActions

data class TemplateActions(
    val onNoteClick: (String) -> Unit,
    val onContentClick: ()-> Unit,
    val onWorkspaceClick: () -> Unit,
    val onFilterClick: () -> Unit,
    val onChatClick: () -> Unit,
    val onSearchClick: () -> Unit,
    val onQueryChange: (String) -> Unit,
    val onCreateNoteClick: () -> Unit,
    val onCreateTemplateClick: ()->Unit,
    val onNoteEditClick: (String) -> Unit
)

@Composable
fun TemplateScreen(
    templateViewModel: TemplateViewModel,
    onProfileClick: () -> Unit,
    featureActions: FeatureActions
) {
    val fetching by templateViewModel.fetching.collectAsState()

    val actions = TemplateActions(
        onNoteClick = { noteId:String -> featureActions.navs.navigateToNoteCreation(NoteType.CONTENT, noteId) },
        onNoteEditClick = {noteId:String -> featureActions.navs.navigateToNoteEdit(noteId)},
        onContentClick = {  featureActions.navs.navigateToMainTagReset(
            featureActions.state.getWorkspaceId()) },
        onWorkspaceClick = { featureActions.ws.navigateToWsSelect() },
        onFilterClick = { featureActions.navs.navigateToFilter(
            workspaceId = featureActions.state.getWorkspaceId(),
            selectedTags = featureActions.state.getSelectedTags(),
            allTagsSelected = featureActions.state.getAllTagsSelected()
        )},
        onChatClick={
            featureActions.navs.navigateToChat(
                featureActions.state.getWorkspaceId()
            )
        },
        onSearchClick = { featureActions.navs.navigateToTemplate(
            workspaceId = featureActions.state.getWorkspaceId(),
            selectedTags = featureActions.state.getSelectedTags(),
            allTagsSelected = featureActions.state.getAllTagsSelected(),
            searchQuery = featureActions.state.getSearchQuery()
        ) },
        onQueryChange = {query:String -> featureActions.state.setSearchQuery(query)},
        onCreateNoteClick = { featureActions.navs.navigateToNoteCreation(NoteType.CONTENT) },
        onCreateTemplateClick = { featureActions.navs.navigateToNoteCreation(NoteType.TEMPLATE)}
    )

    TemplateContent(
        onProfileClick = onProfileClick,
        actions = actions,
        templates = templateViewModel.getNotesTitlesFound(0),
        fetching = fetching,
        wsname = templateViewModel.getWorkspaceName(),
        query = featureActions.state.getSearchQuery()
    )
}

@Composable
private fun TemplateContent(
    onProfileClick: () -> Unit,
    actions: TemplateActions,
    templates:List<Note>,
    query:String,
    fetching: Boolean,
    wsname:String,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            MainTopBar(onProfileClick = onProfileClick)
        },
        bottomBar = {
            TemplateBottomBar(
                onWorkspacesClick = actions.onWorkspaceClick,
                onChatClick = actions.onChatClick,
                onContentClick = actions.onContentClick,
                modifier = modifier)
        }
    ) { paddingValues ->
        if(fetching){
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {CircularProgressIndicator(modifier = modifier.align(Alignment.Center))}
        }
        else{
            TemplateBody(
            paddingValues = paddingValues,
                actions = actions,
            templates = templates,
            wsname = wsname,
            query = query)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MainTopBar(
    onProfileClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    TopAppBar(
        modifier = modifier,
        title = {
            AppTitle()
        },
        actions = {
            ProfileActionButton(onClick = onProfileClick)
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

@Composable
private fun AppTitle(
    modifier: Modifier = Modifier
) {
    Text(
        text = stringResource(R.string.app_name),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Medium,
        modifier = modifier.clickable { /* Do nothing - title is not clickable */ }
    )
}

@Composable
private fun ProfileActionButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    IconButton(
        onClick = onClick,
        modifier = modifier.size(spacing.extraLarge2)
    ) {
        ProfileIcon()
    }
}

@Composable
private fun ProfileIcon() {
    Icon(
        name = R.drawable.ic_account_circle,
    )
}

@Composable
private fun TemplateBody(
    paddingValues: PaddingValues,
    query: String,
    actions: TemplateActions,
    templates:List<Note>,
    wsname:String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(paddingValues)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        val spacing = LocalSpacing.current
        TemplateLabel(wsname = wsname)
        SearchBar(
            onSearchClick = actions.onSearchClick,//TODO: for now
            onFilterClick = actions.onFilterClick,
            onQueryChange = actions.onQueryChange,
            query = query
        )

        HorizontalDivider(modifier = modifier.padding(spacing.medium))
        Button(onClick = actions.onCreateNoteClick,
            modifier = modifier.padding(
                start = spacing.medium, end = spacing.medium)){
            Text(stringResource(R.string.blank_note))
        }
        Button(onClick = actions.onCreateTemplateClick,
            modifier = modifier.padding(
                start = spacing.medium, end = spacing.medium, top = spacing.small, bottom = spacing.small)) {
            Text(stringResource(R.string.new_template))
        }
        TemplateDisplayList(
            templates = templates,
            onTitleClick = actions.onNoteClick,
            onEditClick = actions.onNoteEditClick,
        )
    }
}
@Composable
private fun TemplateLabel(
    wsname: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = wsname + stringResource(R.string.plusTemplates),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = modifier.padding(horizontal = LocalSpacing.current.medium),
        maxLines = 2,
        softWrap = true
    )
}

