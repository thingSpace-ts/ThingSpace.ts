package com.cpen321.usermanagement

import android.util.Log
import androidx.activity.compose.setContent
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotDisplayed
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsNotFocused
import androidx.compose.ui.test.isDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.textAsString
import androidx.test.uiautomator.uiAutomator
import com.cpen321.usermanagement.data.local.preferences.TokenManager
import com.cpen321.usermanagement.data.remote.api.UserInterface
import com.cpen321.usermanagement.data.repository.AuthRepository
import com.cpen321.usermanagement.data.repository.ProfileRepository
import com.cpen321.usermanagement.data.repository.ProfileRepositoryImpl
import com.cpen321.usermanagement.ui.viewmodels.ProfileViewModel
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import java.lang.Thread.sleep
import javax.inject.Inject
import kotlin.math.sign

/*
* Please log in to the below accounts on your emulator:
* vanaukstinfriedrich@gmail.com
* thing4g@gmail.com
* Passwords as in attachments.
* Fill in the bio's of the accounts (with anything, just not empty).
*
* In case this test case fails, there might be a ghost Study v2 workspace in Thing4G's
* workspaces. Please manually remove it before re-running the test.
*
* To run correctly, the test requires a pre-existing workspace called Test and no workspaces named
* Study or Study v2
*
* It might happen the UI Automator picks the wrong button on sign in. In this case:
* 1) Invalidate cache
* 2) run the app regularly, sign in to any account
* 3) run the test again (this time should work)
* */


@HiltAndroidTest
class TestCollaborate {

    companion object{
        const val MEMBER_ACCT_NAME="Friedrich van Aukstin"
        const val MEMBER_ACCT_GMAIL="vanaukstinfriedrich@gmail.com"
        const val MEMBER_ACCT_WS="Friedrich van Aukstin's Personal Workspace"
        const val ACCT_NAME="Thing4G"
        const val ACCT_GMAIL="thing4g@gmail.com"
        const val ACCT_WS = "Thing4G's Personal Workspace"

        //Error/Success messages
        const val saveConfirmString = "Profile updated successfully!"
        const val failedCrWsString = "Failed to create workspace."
        const val invalidEmailString = "Could not retrieve the profile matching the given email!"
        const val addedAMemberString = "The user got added to the workspace."
        const val alreadyAMemberString = "The user is already a member!"
        const val bannedString = "That user is banned!"

        //test workspace names and descriptions, etc.
        const val testWsName = "Test"
        const val studyWsName = "Studies"
        const val v2Name = "Studies v2"
        const val v2Bio = "Study group"
        const val invalidEmailSample = "invalidemail"
        const val chatMessage = "Hello team!"
    }

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<MainActivity>()

    private fun waitForVm(millis: Long){
        composeRule.waitForIdle()
        sleep(millis)
        composeRule.waitForIdle()
    }

    private fun waitForText(textContent:String){
        composeRule.waitUntil(20000){
            composeRule //Waiting for the success message to disappear
                .onAllNodesWithText(textContent)
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }

    private fun waitForDescription(contentDescription:String){
        composeRule.waitUntil(20000){
            composeRule //Waiting for the success message to disappear
                .onAllNodesWithContentDescription(contentDescription)
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }

    private fun waitForTag(contentDescription:String){
        composeRule.waitUntil(20000){
            composeRule //Waiting for the success message to disappear
                .onAllNodesWithTag(contentDescription)
                .fetchSemanticsNodes()
                .isNotEmpty()
        }
    }

    private fun signIn(signInString:String, acctName:String){
        composeRule.waitForIdle()
        composeRule.onNodeWithText(signInString).performClick()
        uiAutomator {
            Log.d("TEST_SIGN_IN", "Before Sign in user selected")
            onElement { textAsString() == acctName }.click()
            Log.d("TEST_SIGN_IN", "Sign in user selected")
        }
        waitForVm(2000)
    }

    @Test
    fun testCollaborate() {
        hiltRule.inject()
        composeRule.activity.setContent {
            UserManagementApp()
        }

        //Ui texts
        val signInString = composeRule.activity.getString(R.string.sign_in_with_google)
        val createWsString = composeRule.activity.getString(R.string.create_new_workspace)
        val pickWsNameString = composeRule.activity.getString(R.string.pick_workspace_name)
        val crWsButtonString = composeRule.activity.getString(R.string.create_workspace)
        val manageWsPrString = composeRule.activity.getString(R.string.manage_workspace_profile)
        val wsIcString = composeRule.activity.getString(R.string.workspaces)
        val trashIcString = composeRule.activity.getString(R.string.delete)
        val wsDescriptionString = composeRule.activity.getString(R.string.bio)
        val saveButtonString = composeRule.activity.getString(R.string.save)
        val wsInviteString = composeRule.activity.getString(R.string.invite)
        val emailBoxString = composeRule.activity.getString(R.string.enter_invite_email)
        val wsInviteButtonString = composeRule.activity.getString(R.string.invite_to_workspace)
        val backIcString = composeRule.activity.getString(R.string.back_icon_description)
        val chatIcString = composeRule.activity.getString(R.string.chat)
        val sendIcString = composeRule.activity.getString(R.string.send)
        val chatTextBoxString = composeRule.activity.getString(R.string.type_message)
        val noMessagesString = composeRule.activity.getString(R.string.no_messages_yet)
        val profileIcString = composeRule.activity.getString(R.string.profile)
        val signOutString = composeRule.activity.getString(R.string.sign_out)
        val leaveIcString = composeRule.activity.getString(R.string.leave)
        val membersIcString = composeRule.activity.getString(R.string.members)
        val banIcString = composeRule.activity.getString(R.string.ban)

        try{uiAutomator { onElement { textAsString()=="Allow" }.click() }}catch(e:Exception){}
        waitForVm(2000)
        if(composeRule.onNodeWithText(signInString).isDisplayed()) signIn(signInString = signInString, ACCT_NAME)
        Log.d("TEST COLLABORATE","Workspace Creation Tests")
        waitForDescription(wsIcString)
        composeRule.onNodeWithContentDescription(wsIcString).performClick()
        waitForText(createWsString)
        composeRule.onNodeWithText(createWsString).performClick()
        composeRule.waitForIdle()
        composeRule.onNodeWithText(text = crWsButtonString).assertIsNotEnabled()
        Log.d("TEST COLLABORATE","Duplicate Name Workspace Creation")
        composeRule.onNodeWithText(pickWsNameString).performTextInput(testWsName)
        composeRule.waitForIdle()
        composeRule.onNodeWithText(text = crWsButtonString).performClick()
        waitForText(failedCrWsString)
        Log.d("TEST COLLABORATE","Successful Workspace Creation")
        composeRule.onNodeWithText(pickWsNameString).performTextReplacement(studyWsName)
        composeRule.waitForIdle()
        composeRule.onNodeWithText(text = crWsButtonString).performClick()
        waitForText(manageWsPrString)
        waitForText(studyWsName)

        Log.d("TEST COLLABORATE","Update Workspace Tests")
        composeRule.onNodeWithText(text = studyWsName).performTextReplacement(v2Name)
        composeRule.onNodeWithText(text = wsDescriptionString).performTextInput(v2Bio)
        composeRule.onNodeWithText(text = saveButtonString).performClick()
        waitForText(saveConfirmString)

        Log.d("TEST COLLABORATE","Workspace Invite Tests")
        composeRule.onNodeWithContentDescription(wsInviteString).performClick()
        waitForText(emailBoxString)
        Log.d("TEST COLLABORATE","1) Inviting an invalid email")
        composeRule.onNodeWithText(emailBoxString).performTextInput(invalidEmailSample)
        //UiDevice.getInstance(InstrumentationRegistry.getInstrumentation()).pressBack() //hiding the keyboard so that the success message is unobstructed
        composeRule.onNodeWithText(wsInviteButtonString).performClick()
        waitForText(invalidEmailString)
        Log.d("TEST COLLABORATE","2) A valid invitation")
        composeRule.onNodeWithText(emailBoxString).performTextReplacement(MEMBER_ACCT_GMAIL)
        composeRule.onNodeWithText(wsInviteButtonString).performClick()
        waitForText(addedAMemberString)
        Log.d("TEST COLLABORATE","3) Inviting already a member")
        composeRule.onNodeWithText(wsInviteButtonString).performClick()
        waitForText(alreadyAMemberString)

        Log.d("TEST COLLABORATE","Moving to chat screen")
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithContentDescription(chatIcString+v2Name).performClick()
        waitForVm(2000)

        Log.d("TEST COLLABORATE","Chat tests")
        Log.d("TEST COLLABORATE","Sending a non-empty chat message")
        composeRule.onNodeWithContentDescription(chatTextBoxString).performTextInput(" ")
        composeRule.onNodeWithContentDescription(sendIcString).performClick()
        waitForText(noMessagesString)
        Log.d("TEST COLLABORATE","Sending a non-empty chat message")
        composeRule.onNodeWithContentDescription(chatTextBoxString).performTextInput(chatMessage)
        composeRule.onNodeWithContentDescription(sendIcString).performClick()
        waitForText(chatMessage)
        composeRule.onNodeWithText(noMessagesString).assertIsNotDisplayed()

        Log.d("TEST COLLABORATE","Signing out and signing in as a regular Workspace Member")
        composeRule.onNodeWithContentDescription(profileIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(signOutString).performClick()
        waitForText(signInString)
        signIn(signInString, MEMBER_ACCT_NAME)
        waitForDescription(wsIcString)
        composeRule.onNodeWithContentDescription(wsIcString).performClick()
        waitForVm(2000)

        Log.d("TEST COLLABORATE","Enter the Workspace and see profile blurred out")
        composeRule.onNodeWithTag(v2Name).performClick()
        waitForText(v2Name)
        composeRule.onNodeWithText(wsDescriptionString).assertIsNotEnabled()
        composeRule.onNodeWithText(v2Name).assertIsNotEnabled()

        Log.d("TEST COLLABORATE","Test Leave Workspace")
        composeRule.onNodeWithContentDescription(leaveIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(v2Name).assertIsNotDisplayed()

        Log.d("TEST COLLABORATE","Re-signing in as admin")
        composeRule.onNodeWithTag(MEMBER_ACCT_WS).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(signOutString).performClick()
        waitForText(signInString)
        signIn(signInString, ACCT_NAME)
        waitForDescription(wsIcString)
        composeRule.onNodeWithContentDescription(wsIcString).performClick()
        waitForTag(v2Name)
        composeRule.onNodeWithTag(v2Name).performClick()
        waitForText(wsDescriptionString)
        composeRule.onNodeWithText(wsDescriptionString).assertIsEnabled()

        Log.d("TEST COLLABORATE","Inviting the member again to ban them")
        composeRule.onNodeWithContentDescription(wsInviteString).performClick()
        waitForText(emailBoxString)
        composeRule.onNodeWithText(emailBoxString).performTextReplacement(MEMBER_ACCT_GMAIL)
        composeRule.onNodeWithText(wsInviteButtonString).performClick()
        waitForText(addedAMemberString)
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForVm(2000)

        Log.d("TEST COLLABORATE","Testing Ban")
        composeRule.onNodeWithContentDescription(membersIcString).performClick()
        waitForDescription(banIcString)
        composeRule.onNodeWithContentDescription(banIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(MEMBER_ACCT_NAME).assertIsNotDisplayed()

        Log.d("TEST COLLABORATE", "Checking that the user cannot be re-invited")
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForDescription(wsInviteString)
        composeRule.onNodeWithContentDescription(wsInviteString).performClick()
        waitForText(wsInviteButtonString)
        composeRule.onNodeWithText(wsInviteButtonString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(bannedString).assertIsDisplayed()

        Log.d("TEST COLLABORATE","Sign In as the banned member to confirm that you are out of the workspace")
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithContentDescription(backIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithTag(ACCT_WS).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(signOutString).performClick()
        waitForText(signInString)
        signIn(signInString, MEMBER_ACCT_NAME)
        waitForDescription(wsIcString)
        composeRule.onNodeWithContentDescription(wsIcString).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(v2Name).assertIsNotDisplayed()

        Log.d("TEST COLLABORATE","Final sign in as an admin - to delete the workspace")
        composeRule.onNodeWithTag(MEMBER_ACCT_WS).performClick()
        waitForVm(2000)
        composeRule.onNodeWithText(signOutString).performClick()
        waitForText(signInString)
        signIn(signInString, ACCT_NAME)
        waitForDescription(wsIcString)
        composeRule.onNodeWithContentDescription(wsIcString).performClick()
        waitForTag(v2Name)
        composeRule.onNodeWithTag(v2Name).performClick()
        waitForText(wsDescriptionString)

        Log.d("TEST COLLABORATE","Delete Test")
        //Also makes test re-runnable as the ws to be created is removed to be re-created next time
        composeRule.onNodeWithContentDescription(trashIcString).performClick()
        waitForText(createWsString)
        composeRule.onNodeWithText(text = studyWsName).assertIsNotDisplayed()
    }
}


