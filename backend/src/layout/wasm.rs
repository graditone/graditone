//! WASM-specific bindings for layout engine
//!
//! Provides string-based JSON interface suitable for JavaScript interop

use crate::layout::{LayoutConfig, compute_layout};
use serde_json::Value;
use serde_wasm_bindgen;
use wasm_bindgen::prelude::*;

/// WASM-compatible wrapper for compute_layout
///
/// Takes JSON strings as input and returns JsValue output to avoid
/// Unicode encoding issues with string serialization.
///
/// # Arguments
/// * `score_json` - CompiledScore as JSON string
/// * `config_json` - LayoutConfig as JSON string (optional, uses defaults if empty)
///
/// # Returns
/// GlobalLayout as JsValue (JavaScript object)
///
/// # Errors
/// Returns JS error if JSON parsing or layout computation fails
#[wasm_bindgen]
pub fn compute_layout_wasm(score_json: &str, config_json: &str) -> Result<JsValue, JsValue> {
    // Parse score JSON
    let score: Value = serde_json::from_str(score_json)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse score JSON: {}", e)))?;

    // Parse config JSON or use defaults
    let config: LayoutConfig = if config_json.is_empty() {
        LayoutConfig::default()
    } else {
        serde_json::from_str(config_json)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse config JSON: {}", e)))?
    };

    // Compute layout
    let layout = compute_layout(&score, &config);

    // Serialize to JsValue using serde-wasm-bindgen (preserves Unicode correctly)
    serde_wasm_bindgen::to_value(&layout)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize layout: {}", e)))
}

/// WASM-compatible version of LayoutConfig for TypeScript bindings
///
/// Exists as a separate type to provide cleaner TypeScript interface
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct LayoutConfigWasm {
    max_system_width: f32,
    units_per_space: f32,
    system_spacing: f32,
    system_height: f32,
}

#[wasm_bindgen]
impl LayoutConfigWasm {
    /// Create new LayoutConfig with default values
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        let defaults = LayoutConfig::default();
        Self {
            max_system_width: defaults.max_system_width,
            units_per_space: defaults.units_per_space,
            system_spacing: defaults.system_spacing,
            system_height: defaults.system_height,
        }
    }

    /// Get max system width
    #[wasm_bindgen(getter)]
    pub fn max_system_width(&self) -> f32 {
        self.max_system_width
    }

    /// Set max system width
    #[wasm_bindgen(setter)]
    pub fn set_max_system_width(&mut self, value: f32) {
        self.max_system_width = value;
    }

    /// Get units per space
    #[wasm_bindgen(getter)]
    pub fn units_per_space(&self) -> f32 {
        self.units_per_space
    }

    /// Set units per space
    #[wasm_bindgen(setter)]
    pub fn set_units_per_space(&mut self, value: f32) {
        self.units_per_space = value;
    }

    /// Get system spacing
    #[wasm_bindgen(getter)]
    pub fn system_spacing(&self) -> f32 {
        self.system_spacing
    }

    /// Set system spacing
    #[wasm_bindgen(setter)]
    pub fn set_system_spacing(&mut self, value: f32) {
        self.system_spacing = value;
    }

    /// Get system height
    #[wasm_bindgen(getter)]
    pub fn system_height(&self) -> f32 {
        self.system_height
    }

    /// Set system height
    #[wasm_bindgen(setter)]
    pub fn set_system_height(&mut self, value: f32) {
        self.system_height = value;
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> String {
        let config = LayoutConfig {
            max_system_width: self.max_system_width,
            units_per_space: self.units_per_space,
            system_spacing: self.system_spacing,
            system_height: self.system_height,
        };
        serde_json::to_string(&config).unwrap_or_default()
    }
}
