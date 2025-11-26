package com.cpen321.usermanagement.ui.screens

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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.room.util.query
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.dto.Note
import com.cpen321.usermanagement.ui.components.MessageSnackbar
import com.cpen321.usermanagement.ui.components.MessageSnackbarState
import com.cpen321.usermanagement.ui.viewmodels.MainUiState
import com.cpen321.usermanagement.ui.viewmodels.MainViewModel
import com.cpen321.usermanagement.ui.theme.LocalFontSizes
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.components.MainBottomBar
import com.cpen321.usermanagement.ui.components.NoteDisplayList
import com.cpen321.usermanagement.ui.components.SearchBar
import com.cpen321.usermanagement.utils.FeatureActions
import kotlinx.coroutines.flow.compose

data class MainActions(
    val onNoteClick: (String) -> Unit,
    val onWorkspaceClick: () -> Unit,
    val onFilterClick: () -> Unit,
    val onChatClick: () -> Unit,
    val onSearchClick: () -> Unit,
    val onQueryChange: (String) -> Unit,
    val onCreateNoteClick: () -> Unit
)

@Composable
fun MainScreen(
    mainViewModel: MainViewModel,
    onProfileClick: () -> Unit,
    featureActions: FeatureActions
) {
    val uiState by mainViewModel.uiState.collectAsState()
    val fetching by mainViewModel.fetching.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }
    val wsname =  mainViewModel.getWorkspaceName()

    val actions = MainActions(
        onWorkspaceClick = { featureActions.ws.navigateToWsSelect()},
        onFilterClick = { featureActions.navs.navigateToFilter(
            workspaceId = featureActions.state.getWorkspaceId(),
            selectedTags = featureActions.state.getSelectedTags(),
            allTagsSelected = featureActions.state.getAllTagsSelected()
        ) },
        onSearchClick = {featureActions.navs.navigateToMainWithContext(
            workspaceId = featureActions.state.getWorkspaceId(),
            selectedTags = featureActions.state.getSelectedTags(),
            allTagsSelected = featureActions.state.getAllTagsSelected(),
            searchQuery = featureActions.state.getSearchQuery()
        )},
        onChatClick = { featureActions.navs.navigateToChat(
            featureActions.state.getWorkspaceId()) },
        onCreateNoteClick = { featureActions.navs.navigateToTemplateTagReset(
            featureActions.state.getWorkspaceId()) },
        onNoteClick = {noteId:String -> featureActions.navs.navigateToNoteEdit(noteId)},
        onQueryChange = {query:String -> featureActions.state.setSearchQuery(query)}
    )

    val searchState = SearchState(
        query = featureActions.state.getSearchQuery(),
        workspaceName = wsname, fetching = fetching,
        notes = mainViewModel.getNotesTitlesFound(0) //TODO no pagination 4 now
    )

    MainContent(
        uiState = uiState,
        snackBarHostState = snackBarHostState,
        onProfileClick = onProfileClick,
        actions = actions,
        searchState = searchState,
        onSuccessMessageShown = mainViewModel::clearSuccessMessage,
    )
}

data class SearchState(
    val query: String,
    val workspaceName: String,
    val notes: List<Note>,
    val fetching: Boolean
)

@Composable
private fun MainContent(
    uiState: MainUiState,
    snackBarHostState: SnackbarHostState,
    onProfileClick: () -> Unit,
    actions: MainActions,
    searchState: SearchState,
    onSuccessMessageShown: () -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            MainTopBar(onProfileClick = onProfileClick)
        },
        snackbarHost = {
            MainSnackbarHost(
                hostState = snackBarHostState,
                successMessage = uiState.successMessage,
                onSuccessMessageShown = onSuccessMessageShown
            )
        },
        bottomBar = {
            MainBottomBar(
                onCreateNoteClick = actions.onCreateNoteClick,
                onWorkspacesClick = actions.onWorkspaceClick,
                onChatClick = actions.onChatClick,
                modifier = modifier)
        }
    ) { paddingValues ->
        if(!searchState.fetching) {
            MainBody(
                paddingValues = paddingValues,
                workspaceName = searchState.workspaceName,
                actions = actions,
                notes = searchState.notes,
                query = searchState.query
            )
        }
        else{
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {CircularProgressIndicator(modifier = modifier.align(Alignment.Center))}
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
        contentDescription = stringResource(R.string.profile)
    )
}

@Composable
private fun MainSnackbarHost(
    hostState: SnackbarHostState,
    successMessage: String?,
    onSuccessMessageShown: () -> Unit,
    modifier: Modifier = Modifier
) {
    MessageSnackbar(
        hostState = hostState,
        messageState = MessageSnackbarState(
            successMessage = successMessage,
            errorMessage = null,
            onSuccessMessageShown = onSuccessMessageShown,
            onErrorMessageShown = { }
        ),
        modifier = modifier
    )
}

@Composable
private fun MainBody(
    paddingValues: PaddingValues,
    actions: MainActions,
    workspaceName: String,
    query: String,
    notes:List<Note>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(paddingValues)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        WorkspaceName(workspaceName)
        SearchBar(
            onSearchClick = actions.onSearchClick,
            onFilterClick = actions.onFilterClick,
            onQueryChange = actions.onQueryChange,
            query = query
        )
        NoteDisplayList(
            onNoteClick = actions.onNoteClick,
            notes = notes,
        )
    }
}
@Composable
private fun WorkspaceName(
    workspaceName: String,
    modifier: Modifier = Modifier
) {
    Text(
        text = workspaceName + stringResource(R.string.plusContent),
        style = MaterialTheme.typography.titleLarge,
        fontWeight = FontWeight.Medium,
        color = MaterialTheme.colorScheme.onSurface,
        modifier = modifier.padding(horizontal = LocalSpacing.current.medium),
        maxLines = 2,
        softWrap = true
    )
}

