package com.cpen321.usermanagement.ui.screens

import Button
import Icon
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.cpen321.usermanagement.R
import com.cpen321.usermanagement.data.remote.api.RetrofitClient
import com.cpen321.usermanagement.data.remote.dto.User
import com.cpen321.usermanagement.data.remote.dto.Workspace
import com.cpen321.usermanagement.ui.components.ImagePicker
import com.cpen321.usermanagement.ui.components.MessageSnackbar
import com.cpen321.usermanagement.ui.components.MessageSnackbarState
import com.cpen321.usermanagement.ui.components.WsProfileManagerBar
import com.cpen321.usermanagement.utils.FeatureActions
import com.cpen321.usermanagement.ui.theme.LocalSpacing
import com.cpen321.usermanagement.ui.viewmodels.DeletingTracer
import com.cpen321.usermanagement.ui.viewmodels.WsProfileManagerUiState
import com.cpen321.usermanagement.ui.viewmodels.WsProfileManagerViewModel

private data class WsProfileFormState(
    val name: String = "",
    val description: String = "",
    val originalName: String = "",
    val originalDescription: String = ""
) {
    fun hasChanges(): Boolean {
        return (name.isNotBlank() && name != originalName) ||
                (description != originalDescription && description.isNotBlank())
    }
}

private data class WsManageProfileScreenActions(
    val onBackClick: () -> Unit,
    val onNameChange: (String) -> Unit,
    val onDescriptionChange: (String) -> Unit,
    val onEditPictureClick: () -> Unit,
    val onSaveClick: () -> Unit,
    val onImagePickerDismiss: () -> Unit,
    val onImageSelected: (Uri) -> Unit,
    val onLoadingPhotoChange: (Boolean) -> Unit,
    val onSuccessMessageShown: () -> Unit,
    val onErrorMessageShown: () -> Unit,

    val onInviteClick: ()-> Unit,
    val onMembersClick: ()->Unit,
    val onDeleteClick: ()->Unit
)


private data class WorkspaceProfileFormData(
    val workspace: Workspace,
    val formState: WsProfileFormState,
    val isLoadingPhoto: Boolean,
    val isSavingProfile: Boolean,
    val onNameChange: (String) -> Unit,
    val onDescriptionChange: (String) -> Unit,
    val onEditPictureClick: () -> Unit,
    val onSaveClick: () -> Unit,
    val onLoadingPhotoChange: (Boolean) -> Unit
)

private data class WsProfileBodyData(
    val uiState: WsProfileManagerUiState,
    val formState: WsProfileFormState,
    val onNameChange: (String) -> Unit,
    val onDescriptionChange: (String) -> Unit,
    val onEditPictureClick: () -> Unit,
    val onSaveClick: () -> Unit,
    val onLoadingPhotoChange: (Boolean) -> Unit
)

private data class WsProfileFieldsData(
    val name: String,
    val description: String,
    val onNameChange: (String) -> Unit,
    val onDescriptionChange: (String) -> Unit
)

@Composable
fun WsProfileManagerScreen(
    wsProfileManagerViewModel: WsProfileManagerViewModel,
    featureActions: FeatureActions,
) {
    BackHandler { featureActions.ws.navigateToWsSelect() }

    val uiState by wsProfileManagerViewModel.uiState.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }

    var showImagePickerDialog by remember { mutableStateOf(false) }

    // Form state
    var formState by remember {
        mutableStateOf(WsProfileFormState())
    }

    WsProfileManagerLaunchedEffects(
        wsProfileManagerViewModel = wsProfileManagerViewModel,
        uiState = uiState,
        featureActions = featureActions,
        onFormStateUpdate = { formState = it }
    )

    if (uiState.deleting == DeletingTracer.NOT) {
        WsProfileManagerContent(
            uiState = uiState,
            formState = formState,
            snackBarHostState = snackBarHostState,
            featureActions = featureActions,
            wsProfileManagerViewModel = wsProfileManagerViewModel,
            dialogState = ImagePickerDialogState(
                showImagePickerDialog = showImagePickerDialog,
                onShowImagePickerDialogChange = { showImagePickerDialog = it }
            ),
            onFormStateChange = { formState = it }
        )
    }
    else{
        Box(modifier = Modifier, contentAlignment = Alignment.Center){
            CircularProgressIndicator()}
    }
}

@Composable
private fun WsProfileManagerLaunchedEffects(
    wsProfileManagerViewModel: WsProfileManagerViewModel,
    uiState: WsProfileManagerUiState,
    featureActions: FeatureActions,
    onFormStateUpdate: (WsProfileFormState) -> Unit
) {
    LaunchedEffect(Unit) {
        wsProfileManagerViewModel.clearSuccessMessage()
        wsProfileManagerViewModel.clearError()
        if (uiState.workspace?._id != featureActions.state.getWorkspaceId()) {
            wsProfileManagerViewModel.loadProfile()
        }
    }

    LaunchedEffect(uiState.workspace) {
        uiState.workspace?.let { workspace ->
            onFormStateUpdate(
                WsProfileFormState(
                    name = workspace.profile.name,
                    description = workspace.profile.description ?: "",
                    originalName = workspace.profile.name,
                    originalDescription = workspace.profile.description ?: ""
                )
            )
        }
    }

    LaunchedEffect(uiState.deleting) {
        if (uiState.deleting == DeletingTracer.DONE){
            featureActions.ws.navigateToWsSelect()
            wsProfileManagerViewModel.setDelTracer(DeletingTracer.NOT)
        }
    }
}

private data class ImagePickerDialogState(
    val showImagePickerDialog: Boolean,
    val onShowImagePickerDialogChange: (Boolean) -> Unit
)

@Composable
private fun WsProfileManagerContent(
    uiState: WsProfileManagerUiState,
    formState: WsProfileFormState,
    snackBarHostState: SnackbarHostState,
    featureActions: FeatureActions,
    wsProfileManagerViewModel: WsProfileManagerViewModel,
    dialogState: ImagePickerDialogState,
    onFormStateChange: (WsProfileFormState) -> Unit
) {
    val actions = WsManageProfileScreenActions(
        onBackClick = { featureActions.ws.navigateToWsSelect() },
        onNameChange = { onFormStateChange(formState.copy(name = it)) },
        onDescriptionChange = { onFormStateChange(formState.copy(description = it)) },
        onEditPictureClick = { dialogState.onShowImagePickerDialogChange(true) },
        onSaveClick = {
            wsProfileManagerViewModel.updateProfile(formState.name, formState.description)
        },
        onImagePickerDismiss = { dialogState.onShowImagePickerDialogChange(false) },
        onImageSelected = { uri ->
            dialogState.onShowImagePickerDialogChange(false)
            wsProfileManagerViewModel.uploadProfilePicture(uri)
        },
        onLoadingPhotoChange = wsProfileManagerViewModel::setLoadingPhoto,
        onSuccessMessageShown = wsProfileManagerViewModel::clearSuccessMessage,
        onErrorMessageShown = wsProfileManagerViewModel::clearError,
        onInviteClick = { featureActions.ws.navigateToInvite() },
        onMembersClick = { featureActions.ws.navigateToMembersManager() },
        onDeleteClick = { wsProfileManagerViewModel.deleteWorkspace() }
    )

    ManageProfileContent(
        uiState = uiState,
        formState = formState,
        snackBarHostState = snackBarHostState,
        showImagePickerDialog = dialogState.showImagePickerDialog,
        actions = actions
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManageProfileContent(
    uiState: WsProfileManagerUiState,
    formState: WsProfileFormState,
    snackBarHostState: SnackbarHostState,
    showImagePickerDialog: Boolean,
    actions: WsManageProfileScreenActions,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            ProfileTopBar(onBackClick = actions.onBackClick)
        },
        snackbarHost = {
            MessageSnackbar(
                hostState = snackBarHostState,
                messageState = MessageSnackbarState(
                    successMessage = uiState.successMessage,
                    errorMessage = uiState.errorMessage,
                    onSuccessMessageShown = actions.onSuccessMessageShown,
                    onErrorMessageShown = actions.onErrorMessageShown
                )
            )
        },
        bottomBar = {
            WsProfileManagerBar(
                onMembersClick = actions.onMembersClick,
                onInviteClick = actions.onInviteClick,
                onDeleteClick = actions.onDeleteClick)
        }
    ) { paddingValues ->
        ProfileBody(
            paddingValues = paddingValues,
            data = WsProfileBodyData(
                uiState = uiState,
                formState = formState,
                onNameChange = actions.onNameChange,
                onDescriptionChange = actions.onDescriptionChange,
                onEditPictureClick = actions.onEditPictureClick,
                onSaveClick = actions.onSaveClick,
                onLoadingPhotoChange = actions.onLoadingPhotoChange
            )
        )
    }

    if (showImagePickerDialog) {
        ImagePicker(
            onDismiss = actions.onImagePickerDismiss,
            onImageSelected = actions.onImageSelected
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ProfileTopBar(
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    TopAppBar(
        modifier = modifier,
        title = {
            Text(
                text = stringResource(R.string.manage_workspace_profile),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Medium
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(name = R.drawable.ic_arrow_back,
                    contentDescription = stringResource(R.string.back_icon_description))
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

@Composable
private fun ProfileBody(
    paddingValues: PaddingValues,
    data: WsProfileBodyData,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(paddingValues)
    ) {
        when {
            data.uiState.isLoadingProfile -> {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center)
                )
            }

            data.uiState.workspace != null -> {
                ProfileForm(
                    data = WorkspaceProfileFormData(
                        workspace = data.uiState.workspace,
                        formState = data.formState,
                        isLoadingPhoto = data.uiState.isLoadingPhoto,
                        isSavingProfile = data.uiState.isSavingProfile,
                        onNameChange = data.onNameChange,
                        onDescriptionChange = data.onDescriptionChange,
                        onEditPictureClick = data.onEditPictureClick,
                        onSaveClick = data.onSaveClick,
                        onLoadingPhotoChange = data.onLoadingPhotoChange
                    )
                )
            }
        }
    }
}

@Composable
private fun ProfileForm(
    data: WorkspaceProfileFormData,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(spacing.large)
            .verticalScroll(scrollState),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(spacing.large)
    ) {
        ProfilePictureCard(
            profilePicture = data.workspace.profile.imagePath ?: "",
            isLoadingPhoto = data.isLoadingPhoto,
            onEditClick = data.onEditPictureClick,
            onLoadingChange = data.onLoadingPhotoChange
        )

        ProfileFields(
            data = WsProfileFieldsData(
                name = data.formState.name,
                description = data.formState.description,
                onNameChange = data.onNameChange,
                onDescriptionChange = data.onDescriptionChange
            )
        )

        SaveButton(
            isSaving = data.isSavingProfile,
            isEnabled = data.formState.hasChanges(),
            onClick = data.onSaveClick
        )
    }
}

@Composable
private fun ProfilePictureCard(
    profilePicture: String,
    isLoadingPhoto: Boolean,
    onEditClick: () -> Unit,
    onLoadingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(spacing.extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            ProfilePictureWithEdit(
                profilePicture = profilePicture,
                isLoadingPhoto = isLoadingPhoto,
                onEditClick = onEditClick,
                onLoadingChange = onLoadingChange
            )
        }
    }
}

@Composable
private fun ProfilePictureWithEdit(
    profilePicture: String,
    isLoadingPhoto: Boolean,
    onEditClick: () -> Unit,
    onLoadingChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    val spacing = LocalSpacing.current

    Box(
        modifier = modifier.size(spacing.extraLarge5)
    ) {
        AsyncImage(
            model = RetrofitClient.getPictureUri(profilePicture),
            onLoading = { onLoadingChange(true) },
            onSuccess = { onLoadingChange(false) },
            onError = { onLoadingChange(false) },
            contentDescription = stringResource(R.string.profile_picture),
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
        )

        if (isLoadingPhoto) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(spacing.large),
                    color = MaterialTheme.colorScheme.primary,
                    strokeWidth = 2.dp
                )
            }
        }

        IconButton(
            onClick = onEditClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(spacing.extraLarge)
                .background(
                    color = MaterialTheme.colorScheme.primary,
                    shape = CircleShape
                )
        ) {
            Icon(
                name = R.drawable.ic_edit,
                type = "light"
            )
        }
    }
}

@Composable
private fun ProfileFields(
    data: WsProfileFieldsData,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        OutlinedTextField(
            value = data.name,
            onValueChange = data.onNameChange,
            label = { Text(stringResource(R.string.name)) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        //Row(Modifier.focusProperties { canFocus = false }) {
        OutlinedTextField(
            value = data.description,
            onValueChange = data.onDescriptionChange,
            label = { Text(stringResource(R.string.bio)) },
            placeholder = { Text(stringResource(R.string.bio_placeholder)) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5,
            readOnly = false //Here a fix was conducted: Users SHOULD be able to edit their description after account creation
        )
        //} //this modifier was also blocking description editability, hence commented out
    }
}

@Composable
private fun SaveButton(
    isSaving: Boolean,
    isEnabled: Boolean,
    onClick: () -> Unit,
) {
    val spacing = LocalSpacing.current

    Button(
        onClick = onClick,
        enabled = !isSaving && isEnabled,
    ) {
        if (isSaving) {
            CircularProgressIndicator(
                modifier = Modifier.size(spacing.medium),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.height(spacing.small))
        }
        Text(
            text = stringResource(if (isSaving) R.string.saving else R.string.save),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Medium
        )
    }
}