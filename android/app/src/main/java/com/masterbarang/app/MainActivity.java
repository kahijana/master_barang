package com.masterbarang.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(AppSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
