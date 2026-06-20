mod scanner;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_positioner::{Position, WindowExt};

// Bir pencereyi öne getir (göster + odakla).
fn show_window(app: &tauri::AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

// Ana pencereyi öne getirip istenen sekmeyi seç ("pano" | "files").
fn show_main_tab(app: &tauri::AppHandle, tab: &str) {
    show_window(app, "main");
    let _ = app.emit("open-tab", tab);
}

// Tam uygulama penceresini öne getir (Pano sekmesi).
fn show_main(app: &tauri::AppHandle) {
    show_main_tab(app, "pano");
}

// Menü-çubuğu popover'ını tray altında aç/kapat.
fn toggle_popover(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("popover") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            if w.move_window(Position::TrayBottomCenter).is_err() {
                let _ = w.move_window(Position::TopRight);
            }
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            scanner::list_volumes,
            scanner::volume_connected,
            scanner::list_dir,
            scanner::reveal_in_finder,
            scanner::open_path,
            scanner::generate_preview,
            scanner::scan_drive,
            scanner::index_status,
            scanner::load_index,
            scanner::get_thumb,
        ])
        .setup(|app| {
            // Gerçek uygulama: dock'ta görün (Regular). Popover skipTaskbar olduğu
            // için dock'ta görünmez, sadece main pencere dock ikonuna bağlıdır.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            // Tray menüsü
            let panel_i = MenuItem::with_id(app, "panel", "Hızlı Panel", true, None::<&str>)?;
            let open_i = MenuItem::with_id(app, "open", "Uygulamayı Aç", true, None::<&str>)?;
            let files_i =
                MenuItem::with_id(app, "files", "Diskler & Dosyalar", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Çıkış", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&panel_i, &open_i, &files_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .icon_as_template(true)
                .tooltip("intiba — Şimdi ne yapmalısın")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "panel" => toggle_popover(app),
                    "open" => show_main(app),
                    "files" => show_main_tab(app, "files"),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label().to_string();
            match event {
                // Pencereyi kapatmak yerine gizle (uygulama arka planda yaşasın).
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let _ = window.hide();
                    api.prevent_close();
                }
                // Popover odağı kaybedince gizlensin (menü davranışı). Main kalır.
                tauri::WindowEvent::Focused(false) if label == "popover" => {
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Dock ikonuna tıklayınca (tüm pencereler gizliyken) main'i geri getir.
            if let tauri::RunEvent::Reopen { .. } = event {
                show_main(app);
            }
        });
}
