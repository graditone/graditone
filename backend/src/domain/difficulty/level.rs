use serde::de::{self, Visitor};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Discrete difficulty classification derived from the combined score
/// (note density + polyphony).
/// Easy: < 2.5, Medium: 2.5–3.5, Hard: > 3.5.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
pub enum DifficultyLevel {
    Easy = 1,
    Medium = 2,
    Hard = 3,
}

/// Accept both string variants ("Easy", "Medium", "Hard") from Rust-side
/// serialization AND integer values (1, 2, 3) from DifficultyRatingDto
/// on the JavaScript/WASM boundary.
impl<'de> Deserialize<'de> for DifficultyLevel {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: de::Deserializer<'de>,
    {
        struct DifficultyLevelVisitor;

        impl<'de> Visitor<'de> for DifficultyLevelVisitor {
            type Value = DifficultyLevel;

            fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
                formatter.write_str("\"Easy\", \"Medium\", \"Hard\" or integer 1, 2, 3")
            }

            fn visit_str<E: de::Error>(self, value: &str) -> Result<DifficultyLevel, E> {
                match value {
                    "Easy" => Ok(DifficultyLevel::Easy),
                    "Medium" => Ok(DifficultyLevel::Medium),
                    "Hard" => Ok(DifficultyLevel::Hard),
                    _ => Err(de::Error::unknown_variant(
                        value,
                        &["Easy", "Medium", "Hard"],
                    )),
                }
            }

            fn visit_u64<E: de::Error>(self, value: u64) -> Result<DifficultyLevel, E> {
                match value {
                    1 => Ok(DifficultyLevel::Easy),
                    2 => Ok(DifficultyLevel::Medium),
                    3 => Ok(DifficultyLevel::Hard),
                    _ => Err(de::Error::invalid_value(
                        de::Unexpected::Unsigned(value),
                        &"1, 2, or 3",
                    )),
                }
            }

            fn visit_i64<E: de::Error>(self, value: i64) -> Result<DifficultyLevel, E> {
                self.visit_u64(value as u64)
            }

            fn visit_f64<E: de::Error>(self, value: f64) -> Result<DifficultyLevel, E> {
                self.visit_u64(value as u64)
            }
        }

        deserializer.deserialize_any(DifficultyLevelVisitor)
    }
}

impl DifficultyLevel {
    /// Map a combined difficulty score to a difficulty level.
    pub fn from_density_rate(rate: f64) -> Self {
        if rate < 2.5 {
            DifficultyLevel::Easy
        } else if rate <= 3.5 {
            DifficultyLevel::Medium
        } else {
            DifficultyLevel::Hard
        }
    }
}

/// Computed difficulty rating for a score, based on note density.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifficultyRating {
    pub density_rate: f64,
    pub level: DifficultyLevel,
}

impl PartialEq for DifficultyRating {
    fn eq(&self, other: &Self) -> bool {
        self.level == other.level && (self.density_rate - other.density_rate).abs() < f64::EPSILON
    }
}

impl Eq for DifficultyRating {}
