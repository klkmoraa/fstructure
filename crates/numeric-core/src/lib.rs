//! Local sparse matrix boundary for FStructure's optional WebAssembly backend.

use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MatrixError {
    InvalidDimensions,
    InvalidPointers,
    InvalidIndices,
    InvalidValues,
    DimensionMismatch,
    FactorizationFailed,
}

impl Display for MatrixError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{self:?}")
    }
}

impl std::error::Error for MatrixError {}

#[derive(Debug, Clone, PartialEq)]
pub struct CscMatrix {
    row_count: usize,
    column_count: usize,
    column_pointers: Vec<usize>,
    row_indices: Vec<usize>,
    values: Vec<f64>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct CsrMatrix {
    row_count: usize,
    column_count: usize,
    row_pointers: Vec<usize>,
    column_indices: Vec<usize>,
    values: Vec<f64>,
}

fn validate_compressed(
    row_count: usize,
    column_count: usize,
    pointers: &[usize],
    indices: &[usize],
    values: &[f64],
    major_count: usize,
    minor_count: usize,
) -> Result<(), MatrixError> {
    if row_count == 0 || column_count == 0 {
        return Err(MatrixError::InvalidDimensions);
    }
    if pointers.len() != major_count + 1
        || pointers.first() != Some(&0)
        || pointers.last() != Some(&values.len())
        || pointers.windows(2).any(|pair| pair[0] > pair[1])
    {
        return Err(MatrixError::InvalidPointers);
    }
    if indices.len() != values.len() || indices.iter().any(|&index| index >= minor_count) {
        return Err(MatrixError::InvalidIndices);
    }
    if values.iter().any(|value| !value.is_finite()) {
        return Err(MatrixError::InvalidValues);
    }
    Ok(())
}

impl CscMatrix {
    pub fn try_new(
        row_count: usize,
        column_count: usize,
        column_pointers: Vec<usize>,
        row_indices: Vec<usize>,
        values: Vec<f64>,
    ) -> Result<Self, MatrixError> {
        validate_compressed(
            row_count,
            column_count,
            &column_pointers,
            &row_indices,
            &values,
            column_count,
            row_count,
        )?;
        Ok(Self { row_count, column_count, column_pointers, row_indices, values })
    }

    pub fn from_csr(matrix: &CsrMatrix) -> Result<Self, MatrixError> {
        let mut counts = vec![0usize; matrix.column_count];
        for &column in &matrix.column_indices {
            counts[column] += 1;
        }
        let mut column_pointers = vec![0usize; matrix.column_count + 1];
        for column in 0..matrix.column_count {
            column_pointers[column + 1] = column_pointers[column] + counts[column];
        }
        let mut next = column_pointers[..matrix.column_count].to_vec();
        let mut row_indices = vec![0usize; matrix.values.len()];
        let mut values = vec![0.0f64; matrix.values.len()];
        for row in 0..matrix.row_count {
            for source in matrix.row_pointers[row]..matrix.row_pointers[row + 1] {
                let column = matrix.column_indices[source];
                let destination = next[column];
                next[column] += 1;
                row_indices[destination] = row;
                values[destination] = matrix.values[source];
            }
        }
        Self::try_new(
            matrix.row_count,
            matrix.column_count,
            column_pointers,
            row_indices,
            values,
        )
    }

    pub fn column_pointers(&self) -> &[usize] {
        &self.column_pointers
    }
}

impl CsrMatrix {
    pub fn try_new(
        row_count: usize,
        column_count: usize,
        row_pointers: Vec<usize>,
        column_indices: Vec<usize>,
        values: Vec<f64>,
    ) -> Result<Self, MatrixError> {
        validate_compressed(
            row_count,
            column_count,
            &row_pointers,
            &column_indices,
            &values,
            row_count,
            column_count,
        )?;
        Ok(Self { row_count, column_count, row_pointers, column_indices, values })
    }
}

#[cfg(feature = "faer-backend")]
#[derive(Debug, Clone, PartialEq)]
pub struct FaerSolveResult {
    pub solution: Vec<f64>,
    pub condition_estimate: f64,
    pub relative_residual: f64,
}

#[cfg(feature = "faer-backend")]
pub fn solve_csc_with_faer_metrics(
    matrix: &CscMatrix,
    rhs: &[f64],
) -> Result<FaerSolveResult, MatrixError> {
    use faer::prelude::Solve;
    use faer::sparse::{SparseColMat, Triplet};

    if matrix.row_count != matrix.column_count || rhs.len() != matrix.row_count {
        return Err(MatrixError::DimensionMismatch);
    }
    let mut triplets = Vec::with_capacity(matrix.values.len());
    for column in 0..matrix.column_count {
        for index in matrix.column_pointers[column]..matrix.column_pointers[column + 1] {
            triplets.push(Triplet::new(
                matrix.row_indices[index],
                column,
                matrix.values[index],
            ));
        }
    }
    let sparse = SparseColMat::<usize, f64>::try_new_from_triplets(
        matrix.row_count,
        matrix.column_count,
        &triplets,
    )
    .map_err(|_| MatrixError::InvalidIndices)?;
    let factor = sparse.sp_lu().map_err(|_| MatrixError::FactorizationFailed)?;
    let right_hand_side = faer::col::Col::from_fn(rhs.len(), |row| rhs[row]);
    let solved = factor.solve(&right_hand_side);
    let solution: Vec<f64> = (0..rhs.len()).map(|row| solved[row]).collect();

    let matrix_one_norm = (0..matrix.column_count)
        .map(|column| {
            (matrix.column_pointers[column]..matrix.column_pointers[column + 1])
                .map(|index| matrix.values[index].abs())
                .sum::<f64>()
        })
        .fold(0.0f64, f64::max);
    let mut iterate = vec![1.0 / matrix.row_count as f64; matrix.row_count];
    let mut inverse_one_norm = 0.0f64;
    let mut previous_index = usize::MAX;
    for _ in 0..8 {
        let column = faer::col::Col::from_fn(iterate.len(), |row| iterate[row]);
        let y = factor.solve(&column);
        inverse_one_norm = inverse_one_norm.max((0..iterate.len()).map(|row| y[row].abs()).sum());
        let signs = faer::col::Col::from_fn(iterate.len(), |row| if y[row] < 0.0 { -1.0 } else { 1.0 });
        let z = factor.solve_transpose(&signs);
        let index = (0..iterate.len())
            .max_by(|&left, &right| z[left].abs().total_cmp(&z[right].abs()))
            .unwrap_or(0);
        if index == previous_index {
            break;
        }
        previous_index = index;
        iterate.fill(0.0);
        iterate[index] = 1.0;
    }

    let mut residual_max = 0.0f64;
    let mut matrix_infinity_norm = vec![0.0f64; matrix.row_count];
    let mut product = vec![0.0f64; matrix.row_count];
    for column in 0..matrix.column_count {
        for index in matrix.column_pointers[column]..matrix.column_pointers[column + 1] {
            let row = matrix.row_indices[index];
            let value = matrix.values[index];
            product[row] += value * solution[column];
            matrix_infinity_norm[row] += value.abs();
        }
    }
    for row in 0..matrix.row_count {
        residual_max = residual_max.max((product[row] - rhs[row]).abs());
    }
    let matrix_max = matrix_infinity_norm.into_iter().fold(0.0f64, f64::max);
    let solution_max = solution.iter().copied().map(f64::abs).fold(0.0f64, f64::max);
    let rhs_max = rhs.iter().copied().map(f64::abs).fold(0.0f64, f64::max);
    let scale = (matrix_max * solution_max + rhs_max).max(f64::MIN_POSITIVE);

    Ok(FaerSolveResult {
        solution,
        condition_estimate: matrix_one_norm * inverse_one_norm,
        relative_residual: residual_max / scale,
    })
}

#[cfg(feature = "faer-backend")]
pub fn solve_csc_with_faer(matrix: &CscMatrix, rhs: &[f64]) -> Result<Vec<f64>, MatrixError> {
    solve_csc_with_faer_metrics(matrix, rhs).map(|result| result.solution)
}

#[cfg(all(feature = "faer-backend", target_arch = "wasm32"))]
mod wasm {
    use super::{CscMatrix, solve_csc_with_faer_metrics};
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn solve_csc(
        dimension: u32,
        column_pointers: &[u32],
        row_indices: &[u32],
        values: &[f64],
        rhs: &[f64],
    ) -> Result<Box<[f64]>, JsValue> {
        let matrix = CscMatrix::try_new(
            dimension as usize,
            dimension as usize,
            column_pointers.iter().map(|&value| value as usize).collect(),
            row_indices.iter().map(|&value| value as usize).collect(),
            values.to_vec(),
        )
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let solved = solve_csc_with_faer_metrics(&matrix, rhs)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        let mut packed = solved.solution;
        packed.push(solved.condition_estimate);
        packed.push(solved.relative_residual);
        packed.push(solved.relative_residual);
        Ok(packed.into_boxed_slice())
    }
}
