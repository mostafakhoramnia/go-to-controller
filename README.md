# Go to Controller

Navigate from Razor views to ASP.NET Core controllers or service files in VS Code.

## Features
- Press `Ctrl+M, Ctrl+G` in a `.cshtml` file to choose between the controller or related services.
- Uses the view's folder name (e.g., `Views/Home` → `HomeController`).
- Searches current and previous lines for controller references.
- Supports service files in class library projects (e.g., `HomeService.cs`).

## Usage
1. Open a `.cshtml` file (e.g., `MvcApp/Views/Home/Index.cshtml`).
2. Press `Ctrl+M, Ctrl+G` or run "Go to Controller or Service".
3. Select from the menu (e.g., "Controller: HomeController.cs" or "Service: HomeService.cs").
4. The selected file opens.

## Settings
- `goToController.viewsFolder`: Set the views folder (default: `Views`).
- `goToController.servicePatterns`: File patterns for services (default: `["{0}Service.cs", "I{0}Service.cs"]`).

## Requirements
- ASP.NET Core MVC project.
- Service files named like `<ControllerName>Service.cs` or `I<ControllerName>Service.cs`.