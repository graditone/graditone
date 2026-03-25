use serde::{Deserialize, Serialize};

/// Discrete difficulty classification derived from the combined score
/// (note density + polyphony).
/// Easy: < 2.5, Medium: 2.5–3.5, Hard: > 3.5.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum DifficultyLevel {
    Easy = 1,
    Medium = 2,
    Hard = 3,
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
