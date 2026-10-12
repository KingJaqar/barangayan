Below is a detailed breakdown of the **Resident Android Mobile app’s current features and functions**, based on its screens, components, and supporting code.

This covers resident actions, small controls, validation, automatic behavior, and unfinished features. **“Implemented” means present in the source code; I have not verified every item on a running Android device or against the live backend.**

**1. App startup and navigation**

- Display the Barangayan splash screen.
- Animate the splash screen while the app initializes.
- Load the app’s bundled fonts.
- Restore the previous sign-in session.
- Wait for session restoration before choosing the destination screen.
- Show an error when session restoration fails.
- Provide a **Retry session restoration** button.
- Choose the starting screen based on:
  - Signed-in status.
  - Guest mode.
  - Account setup progress.
  - Password recovery state.
  - Incoming authentication callback.
- Handle Google authentication links, including links received during a cold start.
- Route residents to unfinished account setup when required.
- Provide six bottom navigation tabs:
  - Home.
  - Services.
  - Maps.
  - Health.
  - Reports.
  - Settings.
- Display a label and icon for each tab.
- Highlight the selected tab.
- Change selected icons from outline to filled versions.
- Animate the selected tab’s highlight and icon.
- Provide pressed-state feedback.
- Display three separate Reports badges:
  - Active incident count.
  - Unread resolved incident count.
  - Unread announcement count.
- Hide count badges when their count is zero.
- Keep those counts updating while the resident uses other tabs.
- Provide back navigation on detail and form screens.
- Support screen-specific links that open a particular subsection.
- Account for Android status bars and bottom safe areas.

Source: [App navigation](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/_layout.tsx), [Bottom tabs](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/app-tabs.tsx).

**2. Introductory and onboarding screens**

The source includes these onboarding screens; the current root entry normally sends signed-out users to the account-choice screen.

- Welcome screen with Barangayan branding.
- Introduction to the app’s benefits.
- Feature explanation cards.
- Appearance personalization screen.
- Three-step progress indicators.
- **Continue** buttons.
- **Get started** button on the last introductory step.
- Light-mode selection.
- Dark-mode selection.
- Preset accent-color selection.
- Immediate appearance previews.
- Confirmation messages when appearance or accent color changes.
- Animated screen content.
- Scrollable content for smaller screens.

**3. Account choice and guest browsing**

- Choose **Create an Account**.
- Choose **I’m a Resident, Log In**.
- Enter guest browsing through the guest controls.
- Browse public information without a resident session.
- Display guest-specific login prompts.
- Replace personal account information with guest content.
- Prompt guests to sign in before accessing personal requests or activity.
- Require an account for emergency QR functions.
- Require sign-in for medical-drive registration.
- Route guests to login from protected actions.
- Allow guests to access appearance preferences and public help information.

**4. Email registration**

- Enter an email address.
- Use an email-appropriate keyboard.
- Disable automatic capitalization for email entry.
- Validate registration input.
- Request an email confirmation code.
- Display the code-entry step.
- Enter a six-digit code.
- Remove nonnumeric characters from code input.
- Limit input to six digits.
- Support operating-system code autofill.
- Disable verification until six digits are entered.
- Verify the code and continue account creation.
- Display request and verification errors.
- Resend a confirmation code.
- Display the resend cooldown.
- Disable resend while the cooldown is active.
- Preserve cooldown timing through the supporting registration logic.
- Change the email address and return to the email step.
- Open login for an existing account.
- Continue registration with Google.
- Show loading feedback.
- Disable conflicting actions while a request is running.
- Prevent overlapping authentication requests.

**5. Login and Google authentication**

- Sign in with email and password.
- Mask password characters.
- Show or hide the password.
- Submit the login form.
- Display readable login errors.
- Show loading feedback during sign-in.
- Open password recovery.
- Open registration from login.
- Sign in with Google.
- Process the Google browser callback.
- Handle cancelled, incomplete, or failed Google authentication.
- Establish or load the resident profile after Google authentication.
- Prefill supported name information from Google.
- Distinguish Google signup from Google sign-in.
- Link Google to an existing account through the available profile control.
- Use Google identity confirmation for supported sensitive actions.
- Prevent earlier authentication responses from changing a newer account/session flow.

**6. Resident account setup**

- Check whether resident profile setup is complete.
- Check whether the account has a password.
- Determine the next setup step.
- Collect:
  - First name.
  - Last name.
  - Optional middle name.
  - Optional suffix.
  - Sex.
  - Date of birth.
  - Mobile number.
  - House number.
  - Street.
  - Employment status.
  - Optional occupation, where applicable.
- Display account email and assigned locality information.
- Display barangay, city, and province information.
- Mark required fields.
- Validate names and mobile numbers.
- Display field-level errors and success feedback.
- Select sex and employment through choice controls.
- Open the birthday calendar.
- Confirm personal details.
- Proceed to password creation when required.
- Allow **Skip for now** in optional setup flows.
- Allow sign-out from setup.
- Refresh account setup status.
- Retry failed setup-status checks.
- Reload the current profile when it changed elsewhere.
- Detect conflicting or uncertain profile saves.
- Require review of current data before another save after a conflict.
- Preserve password draft state within the owned setup flow.
- Offer **Check whether this password was saved** after an uncertain password request.
- Offer password recovery when needed.
- Prevent leaving or starting conflicting actions while a setup request is finishing.
- Return to the originally requested service after profile completion.

Source: [Account setup](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/account-setup.tsx), [Resident details form](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/resident-details-form.tsx).

**7. Password creation and recovery**

- Create a password.
- Confirm the password.
- Show or hide each password field independently.
- Display password requirements.
- Check that confirmation matches.
- Validate requirements including:
  - At least eight characters.
  - An uppercase letter.
  - A number.
  - A special character.
- Request a password-reset email code.
- Enter the recovery email.
- Display email and request errors.
- Enter the recovery code.
- Verify the recovery code.
- Resend the recovery code.
- Display resend timing.
- Open the new-password screen after verification.
- Enter and confirm a new password.
- Show live requirement indicators.
- Update the password.
- Show update success or failure.
- Restart password recovery when necessary.
- Cancel recovery and return to the appropriate account screen.
- Preserve a limited recovery-flow hint across app restarts.
- Prevent overlapping recovery requests.

**8. Home dashboard**

- Display Barangayan branding.
- Display the signed-in resident’s name.
- Display the resident’s avatar.
- Use a fallback avatar when no image is available.
- Display the resident’s barangay.
- Show a login entry for guests.
- Display the profile-completion banner when applicable.
- Open profile completion from the banner.
- Display the announcement notification bell.
- Display the unread announcement count.
- Open the Announcements subsection when the bell is tapped.
- Display a typeable search box — **currently no search behavior is connected here**.
- Provide quick actions:
  - Request Document.
  - Report Issue.
  - Emergency Info.
  - Medical Info.
- Display up to three recent personal service requests.
- Display each request’s document name.
- Display its reference number.
- Display its status badge.
- Open request tracking by tapping a request.
- Provide **View All** for requests.
- Show an empty-request message.
- Show a guest prompt for personal requests.
- Display the latest announcement preview.
- Format same-day announcement timestamps with **TODAY**.
- Open the announcements area from the preview/action.

**9. Services catalog**

- Switch between:
  - Documents.
  - Requests.
  - Logs.
- Update the search placeholder for the selected subsection.
- Display a typeable search box — **currently not connected to filtering**.
- Load active, nondeleted document types.
- Display available document cards.
- Display document names.
- Display document icons.
- Display prices or fee labels.
- Display processing information where supplied.
- Open a document’s details.
- Display catalog loading state.
- Display an empty catalog message.
- Display catalog-loading errors.
- Retry loading the catalog.
- Display ID-verification status.
- Open the profile’s ID section using **Verify Now**.
- Retry a failed verification check.
- Provide a shortcut back to the Documents subsection.

The catalog is data-driven; the actual available document names depend on configured records.

**10. Document requirements and guidelines**

- Display the document name.
- Display the description.
- Display the fee or pricing rule.
- Display the requirements list.
- Display estimated processing time.
- Expand or collapse additional notes.
- Display guidance about original documents and barangay-hall verification.
- For services using the newer charter contract, display:
  - Office/division.
  - Classification.
  - Transaction type.
  - Who may avail.
  - Checklist of requirements.
  - Where to secure requirements.
  - Client steps.
  - Agency actions.
  - Fees to be paid.
  - Processing time.
  - Person responsible.
- Select **Request This Document**.
- Show **Log In to Request** for guests.
- Display document-loading skeletons.
- Display a document-not-found state.
- Retry failed detail loading.
- Return to Services.

**11. Document request forms**

- Check profile completion before opening protected submission forms.
- Display resident name and mobile number.
- Open Profile to correct resident information.
- Display the service name and pricing information.
- Support both newer charter-based forms and the legacy request form.

For newer charter-based requests:

- Require a verified profile ID before submission.
- Display the approved ID type and version.
- Preview approved front and back ID images.
- Refresh ID-verification status.
- Choose a configured request purpose.
- Cancel purpose selection.
- Enter a purpose explanation when required.
- Display an explanation character counter.
- Enter optional additional notes.
- Enter business name for business services.
- Enter establishment address.
- Attach DTI registration where applicable.
- Attach HOA certification where applicable.
- Select **I am a renter**.
- Attach lessor endorsement when applicable.
- Remove the lessor attachment when renter status is switched off.
- Enter a record/document reference for certified true copies.
- Enter the number of copies.
- Display the page-based fee explanation.
- Acknowledge required personal appearance.
- Choose supporting documents.
- Display selected filenames.
- Replace selected supporting files.
- Remove selected supporting files.
- Accept JPG, PNG, WEBP, or PDF supporting documents.
- Enforce the supporting-file size limit of 5 MB.
- Validate service-specific requirements.
- Display submission errors.
- Disable submission while required verification is missing.
- Show submission progress.
- Prevent duplicate submissions with request-attempt keys.
- Open the assessment/payment screen after successful submission.

For the legacy form:

- Enter purpose/notes.
- Display resident-information chips.
- Choose an ID image.
- Preview the selected image.
- Upload it again to replace the selection.
- Validate the file type and 5 MB size limit.
- Upload evidence before creating the request.
- Continue to payment after submission.

Source: [Charter request form](/C:/Users/User/barangayan/apps/resident-android-mobile/src/components/services/charter-request-form.tsx).

**12. Personal request list**

- Load the resident’s own service requests.
- Display request cards.
- Display document names.
- Display reference numbers.
- Display dates.
- Display status labels and colors.
- Open a request’s tracking screen.
- Filter by:
  - All.
  - Active.
  - Pickup.
  - History.
- Further filter Active requests by:
  - All.
  - Pending Payment.
  - Paid.
  - Processing.
- Reset relevant subfilters when switching filter groups.
- Display loading state.
- Display a no-results message for the selected filter.
- Display request-loading errors.
- Retry loading requests.
- Refresh the list through its data-update subscriptions.
- Show a guest login prompt.

**13. Request tracking and processing time**

- Display the request reference number.
- Display payment method.
- Show **Not yet selected** before a method is chosen.
- Display payment status:
  - Pending.
  - Paid.
  - Waived.
  - Refunded.
- Display the assessed total amount due.
- Display **Awaiting fee assessment** when the fee is not final.
- Display **No payment required** for zero-fee requests.
- Display submitted purpose.
- Display purpose explanation.
- Display submitted service-specific details.
- Display requester notes.
- Display status history.
- Display timestamps for recorded status changes.
- Display staff notes attached to status history.
- Highlight the current stage.
- Display pending future stages.
- Display cancellation information.
- Update tracking information when request data changes.

For newer processing clocks:

- Display agency processing time against the target.
- Display resident waiting time.
- Display total turnaround time.
- Display processing-clock status.
- Display the reason a request is waiting on the resident.
- Display pause and resume records.
- Refresh the processing snapshot automatically.
- Update the displayed elapsed time every second.
- Retry when the processing clock cannot be loaded.

For older requests:

- Retain the original processing estimate.
- Display estimated completion.
- Display a progress percentage and progress bar.
- Identify the previous timing model.

**14. Request and payment cancellation**

- Cancel an eligible unpaid request.
- Ask for confirmation before cancellation.
- Display cancellation progress.
- Display success feedback.
- Display cancellation failures.
- Hide request cancellation when delivery has advanced beyond the eligible state or payment has cleared.
- Cancel an outstanding QR payment attempt separately from the request.
- Ask for confirmation before cancelling payment.
- Handle a payment that completed while cancellation was being attempted.
- Allow another payment attempt after eligible payment cancellation.
- Show the appropriate cancellation action based on the outstanding payment state.

**15. Payment selection and assessment**

- Load the request’s fee assessment.
- Display the assessment and payment eligibility.
- Refresh the assessment.
- Retry assessment loading.
- Choose **Pay at Pickup**.
- Choose **Pay with QR PH**, when enabled.
- Save the selected payment method.
- Start the pickup-payment workflow.
- Continue an existing payment workflow.
- Open the resident’s request.
- Return to Services.
- Display errors from payment-method selection or payment initiation.
- Prevent simultaneous payment actions.
- Handle requests that do not require payment.

**16. QR PH payment**

**This is implemented behind the `EXPO_PUBLIC_QRPH_SETTLEMENT_READY` configuration flag. It should be listed as conditional, rather than assumed available in the deployed app.**

- Create a QR payment source.
- Display QR-generation/loading feedback.
- Display the payment QR image.
- Display payment amount and relevant request information.
- Display the QR expiry countdown.
- Continue an existing unexpired QR payment.
- Preserve the existing payment’s QR and expiry when continuing.
- Handle expired payment attempts.
- Monitor payment status.
- Show confirmed-payment success feedback.
- Open the payment-success screen.
- Cancel a pending payment.
- Save the QR image to the Android photo gallery.
- Request media-library permission.
- Explain permission denial.
- Show saving progress.
- Confirm successful image saving.
- Display saving failures.
- Display payment and connection failures.
- Stop inappropriate payment actions for completed, cancelled, or already-paid requests.

**17. Payment success and receipts**

- Load the confirmed payment receipt.
- Display payment-success information.
- Display reference number.
- Display payment date and time.
- Display payment method.
- Display document fee.
- Display transaction reference where available.
- Format money in Philippine pesos.
- Select **Track My Request**.
- Select **Download Receipt**.
- Generate a PDF receipt.
- Open the Android sharing/saving interface.
- Display a file-location message when sharing is unavailable.
- Show receipt-generation progress.
- Display receipt-download errors.
- Retry loading the receipt.
- Return to the request.
- Return to Home.

**18. Service activity logs**

- Display the resident’s service-request activity.
- Display document/request information.
- Display dates.
- Display applicable amounts.
- Display loading state.
- Display an empty-activity message.
- Display activity-loading errors.
- Retry loading activity.
- Show a login prompt for guests.

**19. Maps**

- Display an interactive map.
- Load OpenStreetMap tiles.
- Pan the map.
- Zoom using map controls and gestures.
- Display the barangay boundary.
- Fit the map to the boundary.
- Use Ampid I as the fallback map focus.
- Switch between incident and evacuation-center map data.
- Display incident markers.
- Display evacuation-center markers.
- Color incident markers by category.
- Filter incidents using category chips.
- Select multiple category filters.
- Clear a category by tapping its selected chip again.
- Search map records through the connected map search field.
- Display a marker’s label when tapped.
- Display the resident’s current-location marker.
- Request foreground location permission.
- Locate the device.
- Recenter the map on the device location.
- Reset the map to the barangay view.
- Display a location-permission tooltip.
- Dismiss the tooltip.
- Recheck permission when the app returns to the foreground.
- Show map-data loading and error states.
- Retry loading map data.
- Display a collapsible DRRM shortcut panel.
- Expand/collapse the panel by tapping.
- Drag the panel to expand/collapse it.
- Animate panel movement and its chevron.
- Open emergency hub information.
- Open evacuation centers.
- Open family information.

The separate filter icon beside map search is present, but its button has no additional action connected.

Source: [Maps screen](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/maps/index.tsx).

**20. Emergency information navigation**

- Open Emergency Info from Home.
- Open it from the Maps shortcuts.
- Switch between five subsections:
  - Hub.
  - Centers.
  - Scan.
  - Family.
  - Alerts.
- Open a particular subsection through a navigation link.
- Animate the selected subsection indicator.
- Return to the previous screen.

**21. Emergency hub and preparedness**

- Display disaster-preparedness guidelines.
- Expand guideline sections.
- Collapse guideline sections.
- Display guideline icons and content.
- Display cached emergency information.
- Provide bundled fallback guidelines when live content is unavailable.
- Include fallback earthquake information for:
  - Before an earthquake.
  - During an earthquake.
  - After an earthquake.
- Display offline-availability labels.
- Display loading placeholders.
- Display no-guidelines states.

**22. Emergency hotlines**

- Display hotline organizations.
- Display configured contact labels/numbers.
- Display category icons.
- Open the phone dialer from a hotline’s call button.
- Call the first configured number for that hotline row.
- Load cached hotline information.
- Provide bundled fallback hotline information.
- Display offline-availability labels.
- Display loading state.
- Display a no-hotlines state.

**23. Evacuation-center directory**

- Load evacuation centers.
- Display centers as a list.
- Display centers on a map.
- Switch between List and Map.
- Display:
  - Center name.
  - Address.
  - Distance, when location is available.
  - Estimated travel time.
  - Current occupancy.
  - Capacity.
  - Occupancy percentage.
  - Full-capacity status.
  - Verification indicator where supplied.
- Display occupancy progress bars.
- Change occupancy colors for normal, high, and full occupancy.
- Display configured facility tags such as:
  - Medical desk.
  - Pet friendly.
  - Generator.
  - Catering.
  - Children.
  - Toilets.
  - Internet.
- Toggle nearest-first ordering.
- Search centers by name in the map view.
- Clear the center search.
- Select a center marker.
- Select a center through the horizontal center picker.
- Focus the map on the selected center.
- Open its compact detail card.
- Close center details.
- Return to showing all centers.
- Reset the center map.
- Display loading, error, and no-results states.
- Retry center loading.
- Load previously cached center records.

**24. Device location and evacuation routing**

- Obtain a current location for center distance/routing.
- Automatically acquire location when permission is already granted and Centers is active.
- Show acquisition progress.
- Display location accuracy information.
- Distinguish approximate and precise permission.
- Detect disabled location services.
- Handle denied permission.
- Offer **Open settings** when needed.
- Retry acquiring location.
- Stop an active acquisition.
- Present a pending location for confirmation when required.
- Accept **Use this location**.
- Discard a pending location.
- Consider a last-known device location through the location controller.
- Pause acquisition when the app backgrounds.
- Recheck permission/services when the app returns.
- Keep center-routing coordinates in memory.
- Calculate straight-line distance estimates.
- Request a road-following walking route to a selected center.
- Draw the route on the map.
- Display road-route distance and estimated walking time.
- Use estimated distance/time when a road route is unavailable.
- Label estimated values.
- Clear/recalculate routing when the location or selected center changes.

Source: [Emergency information and centers](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx).

**25. Emergency QR guide and scanner**

- Display why QR check-in is used.
- Display check-in instructions.
- Display numbered guide steps.
- Load cached QR-guide content.
- Display an offline indicator when applicable.
- Select **Scan QR**.
- Check camera permission.
- Display a camera-permission explanation.
- Request camera access.
- Provide the permission-recovery/settings path where needed.
- Open the rear camera.
- Scan QR codes only.
- Display the scanning frame.
- Display positioning instructions.
- Close the scanner.
- Show processing feedback.
- Prevent processing the same scan repeatedly while a request is active.
- Reject empty QR contents.
- Reject malformed JSON.
- Validate the evacuation-center QR format.
- Reject codes belonging to another barangay.
- Record evacuation-center check-in.
- Attempt to update household check-in status.
- Show a warning if household updating fails after check-in succeeds.
- Display successful check-in confirmation.
- Close the scanner after acknowledgement.
- Display failed-check-in errors.
- Allow another scan after an error.

**26. Showing and sharing evacuation-center QR codes**

- Select **Show QR**.
- Load selectable evacuation centers.
- Select a center through the center picker.
- Default to the first available center when no selection exists.
- Generate the selected center’s check-in QR payload.
- Validate the payload before rendering.
- Display the QR code.
- Display selected-center information.
- Share the QR payload through Android’s share interface.
- Save the rendered QR image to the photo gallery.
- Request media-library access.
- Display download progress.
- Display download success/failure.
- Close the center picker.
- Close the QR modal.
- Dismiss supported modals by tapping outside.
- Animate the QR sheet opening and closing.

**27. Family and household information**

- Display a household/family heading.
- Display the household QR image.
- Request the QR image using the resident’s authenticated session.
- Cache the displayed QR image.
- Show a QR placeholder when necessary.
- Open **Show My Code** in a larger modal.
- Display guidance for presenting the household QR at evacuation centers.
- Display family members.
- Display the total member count.
- Display member names.
- Display member initials.
- Display relationship.
- Display role.
- Add a family member.
- Edit a family member.
- Remove a family member.
- Enter a member name.
- Choose relationships:
  - Spouse.
  - Child.
  - Parent.
  - Sibling.
  - Grandparent.
  - Grandchild.
  - Other.
- Choose roles:
  - Head of Family.
  - Student.
  - Employed.
  - Unemployed.
  - Retired.
  - Minor.
- Validate member input.
- Show member-save progress and errors.
- Display empty-family and loading states.
- Share the profile household-member data used elsewhere in the app.

**28. Emergency alerts**

- Load emergency announcements.
- Display alert title and content.
- Display alert date and time.
- Display alert count.
- Filter by:
  - All.
  - Today.
  - Last Week.
  - Last Month.
  - Last Year.
- Expand/collapse custom date filters.
- Filter by month name.
- Filter by day.
- Filter by year.
- Restrict month input to letters.
- Restrict day/year inputs to numbers.
- Display input guidance/validation tooltips.
- Display the number of active custom filters.
- Display **Showing X of Y alerts**.
- Display no-matching-alerts states.
- Display loading/error states.
- Retry loading emergency alerts.

**29. Health and medical-drive browsing**

- Switch between:
  - Active Medical Drives.
  - My Registrations.
- Display a medical-drive calendar.
- Highlight the selected date.
- Indicate today.
- Display colored event indicators.
- Move to the previous month.
- Move to the next month.
- Open the month/year picker.
- Jump to a chosen month and year.
- Select a day.
- Switch from month-wide results to day-specific results by selecting a date.
- Display all drives for the selected month.
- Exit month-wide viewing.
- Filter by drive category.
- Scroll categories horizontally.
- Use category navigation arrows.
- Support these drive categories:
  - Vaccination.
  - Maternal Care.
  - Blood Drive.
  - Medicine Distribution.
  - Dental Care.
  - Optical Care.
  - Emergency Kit.
  - Medical Screening.
  - Medical Consultation.
  - Minor Surgical Drive.
  - Others.
- Display drive title.
- Display category and category color.
- Display date.
- Display start/end time.
- Display location.
- Display eligibility information.
- Display stock/slot label and units.
- Display remaining stock/slots.
- Display stock/capacity progress.
- Display registration availability.
- Open the applicant registration form.
- Display empty and loading states.
- Refresh medical-drive data when the screen regains focus.
- Update drive/registration data through live subscriptions.

**30. Medical-drive registration**

- Select the resident as applicant.
- Select an existing household member as applicant.
- Open/close the applicant picker.
- Display applicant name.
- Display applicant relationship and role for household members.
- Display applicant avatar or initials.
- Calculate resident age from date of birth.
- Request age manually when needed.
- Display the resident’s address.
- Open Profile to edit household/applicant information.
- Display drive details.
- Display remaining stock/slots.
- Select PWD status.
- Select multiple eligibility/comorbidity options:
  - Hypertension.
  - Diabetes.
  - Immunocompromised.
  - Pregnant.
  - Allergy.
  - None.
- Treat **None** separately from selected conditions.
- Select dose history:
  - 1st Dose.
  - 2nd Dose.
  - Booster.
- Display the data-privacy explanation.
- Select the consent checkbox.
- Require consent before submission.
- Validate age.
- Require sign-in.
- Disable submission when stock is exhausted.
- Show submission progress.
- Display registration errors.
- Submit the registration.
- Display the confirmed applicant number.
- Present successful registration feedback.

**31. My medical registrations**

- Load the resident’s registrations.
- Display registration cards.
- Display related drive information.
- Display applicant number.
- Display status badge.
- Filter by:
  - All.
  - Pending.
  - Confirmed.
  - Attended.
  - Cancelled.
- Open a registration detail sheet.
- Display registration information and dates.
- Display related drive schedule and location.
- Display a status timeline.
- Highlight the current status.
- Use the appropriate timeline for cancelled registrations.
- Close the detail sheet.
- Display loading and no-registration states.
- Update registrations when staff changes their status.

A resident self-cancellation action is **not exposed in the current registration detail sheet**; viewing a Cancelled status does not itself mean residents can cancel there.

Source: [Health screen](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/index.tsx), [Applicant registration](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/health/register.tsx).

**32. Reports navigation and lists**

- Switch between:
  - Incidents.
  - Active.
  - Resolved.
  - Announcements.
- Display the corresponding subsection heading.
- Keep subsection selection synchronized with navigation parameters.
- Reset category/status filters when switching subsections.
- Display the resident’s own incident reports.
- Display active reports separately.
- Display resolved reports separately.
- Filter incidents by:
  - All.
  - Submitted.
  - In Progress.
  - Resolved.
  - Withdrawn.
  - Unresolved.
- Display incident preview cards.
- Display incident title.
- Display category.
- Display status.
- Display relevant dates.
- Display available photo previews.
- Open incident details.
- Provide a floating **Report Issue** action.
- Display loading skeletons.
- Display empty-list states.
- Refresh personal incidents on screen focus.
- Refresh after incident changes.

**33. New incident report**

- Require an account and completed resident profile.
- Select an incident category.
- Use categories configured for the barangay.
- Show category selection feedback.
- Select a waste-management zone for applicable trash-related categories.
- Clear a selected zone by tapping it again.
- Enter the incident title.
- Limit title input to 100 characters.
- Display the title character counter.
- Enter an optional description.
- Limit description input to 1,000 characters.
- Display the description character counter.
- Add photo evidence.
- Attach up to five photos.
- Accept JPG, PNG, and WEBP.
- Enforce the 10 MB per-photo limit.
- Display the current photo count.
- Display photo thumbnails.
- Remove individual photos.
- Show a limit-reached message.
- Establish an initial location from available location/boundary information.
- Open the map location picker.
- Move the report pin.
- Reject pin choices outside the configured boundary.
- Detect an address from coordinates.
- Correct the detected address manually.
- Confirm **Use This Location**.
- Cancel location selection.
- Enter specific area details or landmarks.
- Validate title, category, location, and other input.
- Upload photos before creating the incident.
- Remove freshly uploaded photos if the incident insert fails.
- Display upload/submission errors.
- Show submission progress.
- Display successful submission feedback.
- Return to Reports after dismissing success feedback.

**34. Incident details and community confirmation**

- Display incident title.
- Display incident status.
- Display category.
- Display description.
- Display report date/time.
- Display reported location/address.
- Display specific area information.
- Display incident photos.
- Navigate photos with previous/next controls.
- Select a photo using pagination dots.
- Open a full-screen photo preview.
- Close the full-screen preview.
- Display the incident location on a map.
- Recenter that map.
- Display the status timeline.
- Display recorded resolution information where available.
- Display the confirmation count.
- Confirm another resident’s eligible report.
- Prevent confirming one’s own report.
- Prevent duplicate confirmation.
- Prevent confirmation of terminal-status reports.
- Display already-confirmed feedback.
- Update the confirmation count after confirmation.
- Withdraw the resident’s own report when:
  - Its status is still Submitted/open.
  - It is within the 24-hour withdrawal window.
- Ask for confirmation before withdrawal.
- Explain withdrawal unavailability where applicable.
- Preserve the incident with Withdrawn status.
- Display withdrawal success/failure.
- Update incident details when staff changes the report.

Source: [New incident form](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/new.tsx), [Incident details](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/reports/[incidentId].tsx).

**35. Announcements**

- Load published announcements.
- Display announcement cards.
- Display title.
- Display category.
- Display category color/icon.
- Display publication date/time.
- Display relative-time wording.
- Display a shortened content preview.
- Filter by:
  - All.
  - General.
  - Emergency.
  - Health.
  - Events.
- Open an announcement detail modal.
- Display full content.
- Display available announcement imagery.
- Close the modal.
- Dismiss it through the supported backdrop/close controls.
- Mark an announcement as read.
- Mark it as unread again.
- Mark all announcements as read.
- Display unread visual indicators.
- Update the Home bell and Reports badges after read-state changes.
- Receive new announcement updates through the data subscription.
- Display loading and empty-category states.

**36. Resolved-report read states and counters**

- Mark one resolved report as read.
- Mark it unread again.
- Mark all resolved reports as read.
- Display unread indicators on applicable report cards.
- Update the unread resolved count.
- Keep active-report counts separate from unread counts.
- Count Submitted/open and In Progress reports as active.
- Update counts as reports change status.
- Clear resident-specific counters when there is no signed-in user.

**37. Profile viewing and editing**

- Display the resident’s profile.
- Display the resident’s avatar.
- Display initials when no avatar is available.
- Upload or replace the avatar.
- Display avatar-upload progress.
- Display avatar-upload errors.
- Propagate avatar changes to other screens.
- Edit:
  - First name.
  - Last name.
  - Middle name.
  - Suffix.
  - Sex.
  - Profile email.
  - House number.
  - Street.
  - Mobile number.
  - Employment status.
  - Occupation, where applicable.
  - Date of birth.
- Display the assigned barangay as read-only.
- Display province as read-only.
- Display city as read-only for configured locality records; allow editing in the legacy case.
- Open sex selection.
- Open employment-status selection.
- Highlight the selected choice.
- Clear occupation when the new employment status does not use it.
- Add, edit, and remove household members.
- Track changes before saving.
- Validate required fields.
- Validate email formatting.
- Validate Philippine mobile-number formatting.
- Restrict mobile input to the supported length.
- Display per-field error/success indicators.
- Save profile changes.
- Show saving progress.
- Display save-result toasts.
- Display profile loading and guest states.

The editable **profile email** is a profile-data field; it should not automatically be interpreted as an authentication-email-change workflow.

**38. Birthday calendar**

- Open the shared birthday picker.
- Display a calendar grid.
- Highlight the selected birthday.
- Navigate months.
- Jump through month/year selection.
- Prevent choosing future dates.
- Limit the earliest supported year to 1900.
- Start from the existing birthday.
- Use an adult-age fallback when no birthday exists.
- Save the selected date.
- Close/cancel the picker.
- Preserve dates using local calendar values to avoid timezone day shifts.

**39. Profile ID verification**

- Display ID-verification status:
  - Pending.
  - Verified.
  - Verification failed.
- Select ID type.
- Choose from:
  - PhilSys.
  - Digital PhilSys.
  - Driver’s License.
  - Passport.
  - SSS ID.
  - Voter’s ID.
  - PhilHealth ID.
  - PRC ID.
  - UMID.
  - Postal ID.
  - Senior Citizen ID.
  - PWD ID.
  - GSIS ID.
  - TIN ID.
  - Barangay ID.
  - Other.
- Enter the exact ID name when selecting Other.
- Upload the front side.
- Upload the back side.
- Preview uploaded ID images.
- Replace uploaded images.
- Validate image type and size.
- Display upload progress.
- Display upload failure.
- Submit ID evidence for staff review through the profile-save flow.
- Display verification feedback.
- Open the ID section directly from service verification prompts.
- Use the approved ID for applicable document requests.
- Avoid trusting cached approval when fresh verification cannot be confirmed.

Source: [Profile screen](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/profile.tsx).

**40. Email verification in Settings**

- Display the account’s email-verification state.
- Display Verified feedback.
- Send a verification code.
- Enter a six-digit code.
- Restrict code input to digits.
- Support code autofill.
- Disable verification for incomplete codes.
- Verify the email.
- Resend a code.
- Display resend cooldown.
- Disable resend during cooldown.
- Display loading state.
- Display errors and success feedback.
- Refresh profile information after verification.
- Retry failed profile/status loading.
- Check account/profile email consistency through the verification flow.

**41. Location verification**

- Display a map for the resident’s saved location.
- Display the barangay boundary.
- Load an existing saved pin where available.
- Detect the device’s current location.
- Request foreground location permission.
- Handle denied permission.
- Handle unavailable location.
- Allow manual pin placement/movement.
- Reject locations outside the boundary.
- Detect an address from the selected position.
- Allow correction of the address.
- Save the selected location.
- Display **Location Saved** feedback.
- Display save failures.
- Display verified-location status in Settings.
- Show a login prompt for guests.

**42. Password management in Settings**

- Display password-management status.
- Distinguish accounts with a password from accounts needing a first password.
- Enter current password.
- Enter new password.
- Confirm the new password.
- Show/hide password fields.
- Validate requirements and matching confirmation.
- Verify the current password.
- Update the password.
- Display success/error popups.
- Recover the password by email.
- Retry failed account-status checks.
- Confirm identity with Google before setting a first password where required.
- Set a first password for an eligible Google account.
- Display confirmation that email/password login is now available.
- Cancel or return from password management.

**43. Appearance preferences**

- Select Light theme.
- Select Dark theme.
- Apply the theme throughout the app.
- Apply it to navigation styling.
- Select from preset accent colors.
- Show a checkmark on the active color.
- Scroll the color row.
- Open the custom-color modal.
- Choose hue using a slider.
- Choose saturation/brightness using the color square.
- Preview the chosen color.
- Save a custom color.
- Apply a newly saved color.
- Reject invalid or duplicate custom colors.
- Save up to ten custom colors.
- Display the saved-color count.
- Long-press a custom color to remove it.
- Confirm custom-color removal.
- Cancel removal or color selection.
- Persist supported resident appearance preferences.
- Select a font style.
- Preview each font in its selection chip.
- Highlight the selected font.
- Support ten font choices:
  - System.
  - Inter.
  - Arial.
  - Helvetica.
  - Segoe UI.
  - Verdana.
  - Tahoma.
  - Trebuchet MS.
  - Georgia.
  - Times New Roman.
- Persist the selected font preference.

On Android, several named fonts use available Android fallback families, so different labels may render similarly.

**44. Notifications**

- Turn push notifications on/off.
- Save the resident’s push preference.
- Request notification permission.
- Register the device’s push token.
- Refresh/register the token when an eligible session starts.
- Remove the registered token when push is switched off.
- Present notifications from subscribed events for:
  - New announcements.
  - New medical drives.
  - Medical registration updates.
  - Incident updates.
  - Service-request updates.
- Build event-specific notification titles and messages.
- Respect the push opt-in for the app’s notification subscriptions.
- Handle permission denial or registration failure.
- Avoid unsupported notification registration in Expo Go.
- Require a suitable native build and physical device for the token-registration path.
- Display an SMS preference switch.

**The SMS switch currently changes local screen state only. It does not establish a persisted SMS preference or prove SMS delivery is implemented.**

**45. Download My Data**

- Open an export-format chooser.
- Choose readable PDF.
- Choose raw JSON.
- Cancel before generating the export.
- Request the resident’s data export.
- Display export-preparation progress.
- Prevent another export while one is running.
- Generate a readable PDF from the returned data.
- Generate a JSON file.
- Open Android’s save/share interface.
- Display success/file information where supported.
- Display export errors.
- Render returned sections such as:
  - Account.
  - Profile.
  - Service requests.
  - Incident reports.
  - Medical-drive registrations.
  - Evacuation-center check-ins.
  - Registered devices.

**46. Delete My Account**

- Open the account-deletion workflow.
- Check the account’s current authentication/setup status.
- Display the permanent-deletion explanation.
- Cancel deletion.
- Require password re-entry for the applicable password-account flow.
- Confirm identity with Google for the applicable Google-account flow.
- Require a final explicit deletion confirmation after Google confirmation.
- Submit the account-deletion request.
- Disable conflicting actions during confirmation/deletion.
- Display deletion progress.
- Display deletion failure.
- Clear the session through the completed deletion/logout flow.

**47. Logout and session cleanup**

- Select Logout.
- Display logging-out progress.
- Sign out the current local session.
- Exit guest/session-related state appropriately.
- Clear account-setup hints.
- Clear recovery hints.
- Clear stored Google authentication-flow data.
- Remove resident-specific cached profile data.
- Return to the signed-out flow.
- Display logout feedback.
- Display an error if sign-out cannot be confirmed.
- Require session-restoration recovery before another sign-in when sign-out status is uncertain.

Source: [Settings and account actions](/C:/Users/User/barangayan/apps/resident-android-mobile/src/app/(app)/settings/index.tsx).

**48. Help Center**

- Open the Help Center.
- Load FAQ/help articles.
- Filter by:
  - All.
  - General.
  - Services.
  - Emergency.
  - Health.
  - Billing.
  - Account.
- Display article preview cards.
- Open an article.
- Display article content with Markdown formatting.
- Return to the article list.
- Display loading skeletons.
- Display an empty-category message.
- Display an article-not-found message.
- Display article-loading errors.
- Retry help-list loading.
- Display retry feedback.

**49. Terms, privacy, About Us, and app information**

- Open Terms & Privacy Policy.
- Load published policy content.
- Expand/collapse Terms.
- Expand/collapse Privacy Policy.
- Read formatted policy content.
- Display policy-loading states.
- Open About Us.
- Display configured barangay/app information.
- Display Mission.
- Display Vision.
- Display History.
- Display Contact information.
- Display Development Team information.
- Display About-page loading states.
- Display the configured app version in Settings.

**50. Small shared interactions**

These appear across applicable screens, rather than necessarily on every screen.

- Required-field markers.
- Placeholder text.
- Context-appropriate keyboards.
- Password visibility controls.
- Character counters.
- Selected-choice checkmarks.
- Status badges and icons.
- Progress bars.
- Countdown timers.
- Loading spinners.
- Skeleton placeholders.
- Shimmer effects.
- Empty-state messages.
- Not-found messages.
- Retry buttons.
- Inline errors.
- Success toasts.
- Success/error popups.
- Destructive-action confirmations.
- Disabled controls during active requests.
- Press feedback.
- Fade-in animations.
- Sliding modal sheets.
- Animated subsection indicators.
- Scrollable choice rows.
- Modal close buttons.
- Backdrop dismissal where enabled.
- Android back handling for supported modals and guarded flows.
- Enlarged touch areas on selected controls.
- Accessibility button labels.
- Selected/disabled accessibility states.
- Screen-reader announcements for supported status/error changes.
- Image placeholders and initials.
- Philippine peso formatting.
- Date/time formatting.
- Relative announcement timestamps.
- File-picker cancellation handling.
- Human-readable filenames when Android supplies opaque file identifiers.

**51. Automatic and supporting functions**

- Restore and maintain authentication state.
- Refresh the shared resident profile.
- Refresh profile information when the app returns to the foreground.
- Cache resident demographic information by account.
- Clear cached identity information during logout.
- Keep verification-sensitive decisions dependent on fresh status.
- Subscribe to relevant data changes.
- Refresh subscribed lists and counters after changes.
- Remove subscriptions when their screen/provider is disposed.
- Guard against responses belonging to an earlier account or request.
- Prevent concurrent authentication/setup operations.
- Detect uncertain network outcomes in supported setup flows.
- Protect supported service submissions from accidental duplicates.
- Cache emergency guidelines.
- Cache emergency hotlines.
- Cache QR-guide content.
- Cache evacuation-center records.
- Use bundled emergency-content fallback data.
- Upload resident images and supporting documents.
- Read files chosen through Android’s system picker.
- Handle Android content-file permissions.
- Generate private ID preview URLs.
- Generate QR images.
- Capture QR images for gallery saving.
- Generate receipt PDFs.
- Generate personal-data export PDFs.
- Queue failed evacuation check-in attempts locally.

**52. Present in the source, but incomplete, conditional, or not connected**

These distinctions prevent unfinished items from being counted as fully available features:

- **Home search:** typeable input; no connected search.
- **Services search:** typeable input; no connected filtering/search.
- **Map filter icon:** visible button; no separate action connected. The category chips do work.
- **SMS notifications:** local switch state; no completed persisted SMS opt-in flow shown.
- **QR PH settlement:** conditional on the payment configuration flag.
- **Standalone Maps hotline-directory route:** placeholder screen. Working hotlines are in Emergency Hub.
- **Standalone Maps preparedness-guide route:** placeholder screen. Working guidelines are in Emergency Hub.
- **Offline check-in synchronization:** a queue and synchronization function exist, but I found no caller connecting that synchronization function to automatic reconnect behavior.
- **Notification-tap routing:** a notification-response helper exists, but I found no connected caller that opens the relevant screen from a notification tap.
- **Older health registration modal:** remains in the source; the current Register action opens the full-screen applicant form.
- **Onboarding screens:** implemented routes, but the current signed-out root entry uses account choice rather than starting at Welcome.
- **Weather-based evacuation guidance and BFS/Dijkstra routing:** not wired into the current Android screens inspected. Current center routing uses the road-route helper and distance estimates.

This inventory describes the current implementation and does not include the cancelled Android usability phase as an active feature or planned change.