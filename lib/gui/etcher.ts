/*
 * Copyright 2016 balena.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as electron from 'electron';
import { autoUpdater } from 'electron-updater';
import { promises as fs } from 'fs';
import { platform } from 'os';
import * as path from 'path';
import * as semver from 'semver';

import { packageType, version } from '../../package.json';
import * as EXIT_CODES from '../shared/exit-codes';
import { delay, getConfig } from '../shared/utils';
import * as settings from './app/models/settings';
import { logException } from './app/modules/analytics';
import { buildWindowMenu } from './menu';

const { app, BrowserWindow, ipcMain, protocol, shell } = electron;

const isDevelopment = process.env.NODE_ENV === 'development';

// Register the `etcher:` protocol
protocol.registerSchemesAsPrivileged([
	{
		scheme: 'etcher',
		privileges: {
			standard: true,
			supportFetchAPI: true,
			corsEnabled: true,
		},
	},
]);

// Set the user agent to the Electron version, this is required
// for some services like Microsoft Azure to work.
app.userAgentFallback = `Electron/${app.getVersion()}`;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow: BrowserWindow | null;

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
	// Check if we are running on a supported architecture
	if (!['armv7l', 'x64'].includes(process.arch)) {
		const message = `Etcher does not support the current architecture: ${process.arch}`;
		logException(new Error(message));
		await osDialog.showErrorBox(message);
		app.exit(EXIT_CODES.GENERAL_ERROR);
		return;
	}

	// Check if we are running on an OS that supports Etcher
	if (!['darwin', 'linux', 'win32'].includes(process.platform)) {
		const message = `Etcher does not support the current operating system: ${process.platform}`;
		logException(new Error(message));
		await osDialog.showErrorBox(message);
		app.exit(EXIT_CODES.GENERAL_ERROR);
		return;
	}

	// Check if we are running on a supported OS version
	const MINIMUM_SUPPORTED_VERSIONS = {
		darwin: '10.11.0',
		linux: '3.10.0',
		win32: '6.1.0',
	};
	const minimumVersion = MINIMUM_SUPPORTED_VERSIONS[process.platform];
	if (semver.lt(platform(), minimumVersion)) {
		const message = `Etcher does not support ${process.platform} versions older than ${minimumVersion}`;
		logException(new Error(message));
		await osDialog.showErrorBox(message);
		app.exit(EXIT_CODES.GENERAL_ERROR);
		return;
	}

	// Check if the user has disabled analytics
	if (!(await settings.get('errorReporting')) && !isDevelopment) {
		// Disable analytics
		await
	}

	// Check if the user has disabled automatic updates
	if (!(await settings.get('updatesEnabled'))) {
		// Disable automatic updates
		autoUpdater.autoDownload = false;
		autoUpdater.autoInstallOnAppQuit = false;
	}

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		minWidth: 1280,
		minHeight: 720,
		backgroundColor: '#ffffff',
		title: 'Etcher',
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			nodeIntegration: true,
			// We need to disable the `contextIsolation` option to allow
			// the Angular renderer process to access the Electron API
			contextIsolation: false,
			// We need to enable `webviewTag` to allow the Angular renderer
			// process to create `webview` elements
			webviewTag: true,
			// We need to enable `sandbox` to allow the Angular renderer
			// process to use the `sandbox` attribute on `webview` elements
			sandbox: true,
			// We need to enable `nativeWindowOpen` to allow the Angular
			// renderer process to use `window.open` on `webview` elements
			nativeWindowOpen: true,
			// We need to enable `enableRemoteModule` to allow the Angular
			// renderer process to use the `remote` module in the `webview` elements
			enableRemoteModule: true,
		},
	});

	// Build the window menu
	buildWindowMenu(mainWindow);

	// and load the index.html of the app.
	mainWindow.loadURL(`file://${__dirname}/app/index.html`);

	// Open the DevTools.
	if (isDevelopment) {
		mainWindow.webContents.openDevTools();
	}

	// Emitted when the window is closed.
	mainWindow.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null;
	});

	// Emitted when the window is ready to show.
	mainWindow.on('ready-to-show', () => {
		// Show the window when the page is ready to be shown
		mainWindow.show();
	}

	// Emitted when the window is shown.
	mainWindow.on('show', () => {
		// Check for updates
		autoUpdater.checkForUpdates();
	});

	// Emitted when the window is hidden.
	mainWindow.on('hide', () => {
		// Quit the app when the window is hidden
		app.quit();
	});

	// Emitted when the window is minimized.
	mainWindow.on('minimize', () => {
		// Hide the window when the window is minimized
		mainWindow.hide();
	});
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		app.emit('ready');
	}
});

// Prevent the window from being closed
app.on('before-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('will-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('before-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('will-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('before-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('will-quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow.hide();
});

// Prevent the window from being closed
app.on('quit', (event) => {
	// Prevent the window from being closed
	event.preventDefault();
	// Hide the window
	mainWindow
