package com.justin.family3d;

import android.app.Activity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import java.util.Collections;

/**
 * Native Google authorization for Calendar. Google blocks OAuth inside WebViews, so the app asks
 * Play services for an access token instead (Android account picker; silent when already granted).
 */
@CapacitorPlugin(name = "GoogleAuth")
public class GoogleAuthPlugin extends Plugin {

    // Same least-privilege scope as the website: only calendars Legacy creates.
    private static final String SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), this::onResolution);
    }

    /** { interactive: boolean } → { accessToken } or { needsInteraction: true } when silent isn't possible. */
    @PluginMethod
    public void authorize(PluginCall call) {
        boolean interactive = Boolean.TRUE.equals(call.getBoolean("interactive", true));
        AuthorizationRequest request = AuthorizationRequest.builder().setRequestedScopes(Collections.singletonList(new Scope(SCOPE))).build();
        Identity.getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> {
                if (!result.hasResolution()) {
                    resolveToken(call, result);
                    return;
                }
                if (!interactive || result.getPendingIntent() == null) {
                    JSObject r = new JSObject();
                    r.put("needsInteraction", true);
                    call.resolve(r);
                    return;
                }
                if (pending != null) {
                    call.reject("Google sign-in is already open", "BUSY");
                    return;
                }
                pending = call;
                launcher.launch(new IntentSenderRequest.Builder(result.getPendingIntent().getIntentSender()).build());
            })
            .addOnFailureListener(e -> call.reject(describe(e), codeOf(e)));
    }

    /** Drop a rejected (expired/revoked) token from Play services' cache so the next authorize fetches a fresh one. */
    @PluginMethod
    public void clearToken(PluginCall call) {
        String token = call.getString("token");
        if (token == null) {
            call.resolve();
            return;
        }
        new Thread(() -> {
            try {
                GoogleAuthUtil.clearToken(getContext(), token);
            } catch (Exception ignored) {
                // Nothing cached or already cleared: fine either way.
            }
            call.resolve();
        }).start();
    }

    private void onResolution(ActivityResult ar) {
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (ar.getResultCode() != Activity.RESULT_OK || ar.getData() == null) {
            call.reject("Sign-in window was closed", "CANCELED");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(ar.getData());
            resolveToken(call, result);
        } catch (ApiException e) {
            call.reject(describe(e), codeOf(e));
        }
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        String token = result.getAccessToken();
        if (token == null) {
            call.reject("Google didn't return access to your calendar");
            return;
        }
        JSObject r = new JSObject();
        r.put("accessToken", token);
        call.resolve(r);
    }

    private static String codeOf(Exception e) {
        return e instanceof ApiException ? String.valueOf(((ApiException) e).getStatusCode()) : null;
    }

    private static String describe(Exception e) {
        if (e instanceof ApiException) {
            int code = ((ApiException) e).getStatusCode();
            if (code == CommonStatusCodes.DEVELOPER_ERROR) {
                return "Legacy isn't registered with Google for Android yet (Android OAuth client missing, or its SHA-1 doesn't match this app).";
            }
            if (code == CommonStatusCodes.NETWORK_ERROR) return "No internet connection.";
        }
        return e.getMessage() != null ? e.getMessage() : "Google sign-in failed";
    }
}
