"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
function activate(context) {
    // Register the "Go to Controller or Service" command
    let disposable = vscode.commands.registerCommand('go-to-controller.goto', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }
        const document = editor.document;
        if (!document.fileName.endsWith('.cshtml')) {
            vscode.window.showErrorMessage('This command only works in Razor (.cshtml) files.');
            return;
        }
        // Get the current line and cursor position
        const position = editor.selection.active;
        const line = document.lineAt(position.line).text;
        // Extract controller name
        var controllerName = "";
        const controllerName_FromPath = extractControllerName_FromPath(document);
        var controllerFile = await findControllerFile(controllerName_FromPath || '');
        if (!controllerFile) {
            const controllerName_FromLinks = extractControllerName_FromLinks(line, position, document);
            controllerFile = await findControllerFile(controllerName_FromLinks || '');
            if (!controllerFile) {
                vscode.window.showErrorMessage('Could not identify a controller reference.');
                return;
            }
            controllerName = controllerName_FromLinks;
        }
        else {
            controllerName = controllerName_FromPath;
        }
        // Find controller and service files
        const serviceFiles = await findServiceFiles(controllerName);
        // Prepare quick pick items
        const items = [];
        if (controllerFile) {
            items.push({
                label: `Controller: ${controllerName}Controller.cs`,
                detail: controllerFile.fsPath,
                data: controllerFile
            });
        }
        serviceFiles.forEach((file, index) => {
            items.push({
                label: `Service: ${path.basename(file.fsPath)}`,
                detail: file.fsPath,
                data: file
            });
        });
        if (items.length === 0) {
            vscode.window.showErrorMessage(`No controller or service files found for ${controllerName}.`);
            return;
        }
        // Show quick pick menu
        if (items.length === 1) {
            // If only one option, navigate directly
            const item = items[0];
            const fileUri = item.data;
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc);
        }
        else {
            // Show menu for multiple options
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `Select a file for ${controllerName}`,
                matchOnDetail: true
            });
            if (selected && selected.data) {
                const fileUri = selected.data;
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc);
            }
        }
    });
    context.subscriptions.push(disposable);
}
// Extract controller name from the view file path, current line, or previous lines
function extractControllerName_FromLinks(line, position, document) {
    // Step 1: Define regex patterns for controller references
    const patterns = [
        { regex: /@Html\.ActionLink\s*\([^,]+,\s*["']([^"']+)["']/i, group: 1 }, // @Html.ActionLink("Index", "Home")
        { regex: /@Url\.Action\s*\([^,]+,\s*["']([^"']+)["']/i, group: 1 }, // @Url.Action("Index", "Home")
        { regex: /asp-controller\s*=\s*["']([^"']+)["']/i, group: 1 }, // <form asp-controller="Home">
        { regex: /controller\s*:\s*["']([^"']+)["']/i, group: 1 }, // AJAX: controller: "Home"
        { regex: /["']\/([^\/]+)\//i, group: 1 } // URL path: "/Home/Index"
    ];
    // Step 2: Check the current line for controller references
    for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match && match[pattern.group]) {
            return match[pattern.group];
        }
    }
    // Step 3: Search previous lines (up to 50 lines or start of file)
    const currentLineNumber = position.line;
    const linesToSearch = Math.min(currentLineNumber, 50);
    for (let i = 1; i <= linesToSearch; i++) {
        const prevLineNumber = currentLineNumber - i;
        const prevLine = document.lineAt(prevLineNumber).text;
        for (const pattern of patterns) {
            const match = prevLine.match(pattern.regex);
            if (match && match[pattern.group]) {
                return match[pattern.group];
            }
        }
    }
    // Step 4: Fallback to quoted string near the cursor in the current line
    const quotedStringPattern = /["']([^"']+)["']/g;
    let match;
    while ((match = quotedStringPattern.exec(line))) {
        const start = match.index;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
            return match[1];
        }
    }
    return null;
}
// Extract controller name from the view file path
function extractControllerName_FromPath(document) {
    // Step 1: Try to extract controller name from the view file path
    const config = vscode.workspace.getConfiguration('goToController');
    const viewsFolder = config.get('viewsFolder', 'Views');
    const filePath = document.fileName;
    const pathParts = filePath.split(/[\\/]/); // Split on both \ and / for cross-platform compatibility
    let controllerName = null;
    // Check for Areas first (e.g., Areas/Admin/Views/Home/Index.cshtml)
    const areasIndex = pathParts.indexOf('Areas');
    if (areasIndex !== -1 && areasIndex + 3 < pathParts.length && pathParts[areasIndex + 2] === viewsFolder) {
        controllerName = pathParts[areasIndex + 3]; // e.g., Home
    }
    else {
        // Standard Views folder (e.g., Views/Home/Index.cshtml)
        const viewsIndex = pathParts.indexOf(viewsFolder);
        if (viewsIndex !== -1 && viewsIndex + 1 < pathParts.length) {
            controllerName = pathParts[viewsIndex + 1]; // e.g., Home
        }
    }
    if (controllerName) {
        return controllerName;
    }
    return null;
}
// Find the controller file in the workspace
async function findControllerFile(controllerName) {
    const controllerFileName = `${controllerName}Controller.cs`;
    // Search in Controllers/ and Areas/*/Controllers/
    const files = await vscode.workspace.findFiles(`**/{Controllers,Areas/*/Controllers}/${controllerFileName}`, '**/node_modules/**');
    return files.length > 0 ? files[0] : null;
}
// Find service files in the workspace or other workspace folders
async function findServiceFiles(controllerName) {
    const config = vscode.workspace.getConfiguration('goToController');
    const servicePatterns = config.get('servicePatterns', ['{0}Service.cs', 'I{0}Service.cs']);
    const files = [];
    for (const pattern of servicePatterns) {
        // Replace {0} with controllerName
        const fileName = pattern.replace('{0}', controllerName);
        // Search across all workspace folders
        const foundFiles = await vscode.workspace.findFiles(`**/${fileName}`, '**/node_modules/**');
        files.push(...foundFiles);
    }
    return files;
}
// Clean up when the extension is deactivated
function deactivate() { }
//# sourceMappingURL=extension.js.map