#![cfg(feature = "faer-backend")]

use fstructure_numeric_core::{CscMatrix, CsrMatrix, MatrixError, solve_csc_with_faer};

#[test]
fn faer_factorizes_a_representative_sparse_system_and_matches_the_hand_solution() {
    let csr = CsrMatrix::try_new(
        3,
        3,
        vec![0, 2, 5, 7],
        vec![0, 1, 0, 1, 2, 1, 2],
        vec![4.0, 1.0, 1.0, 3.0, 1.0, 1.0, 2.0],
    )
    .expect("valid CSR fixture");
    let csc = CscMatrix::from_csr(&csr).expect("lossless CSR to CSC conversion");
    let solution = solve_csc_with_faer(&csc, &[6.0, 10.0, 8.0]).expect("faer sparse LU");

    assert_eq!(csc.column_pointers(), &[0, 2, 5, 7]);
    for (actual, expected) in solution.iter().zip([1.0, 2.0, 3.0]) {
        assert!((actual - expected).abs() < 1.0e-12, "{actual} != {expected}");
    }

    assert_eq!(
        CscMatrix::try_new(1, 1, vec![0, 1], vec![0], vec![f64::NAN]),
        Err(MatrixError::InvalidValues),
    );
    assert_eq!(
        solve_csc_with_faer(
            &CscMatrix::try_new(1, 1, vec![0, 1], vec![0], vec![1.0]).unwrap(),
            &[f64::NAN],
        ),
        Err(MatrixError::NonFiniteRightHandSide),
    );
    assert_eq!(
        solve_csc_with_faer(
            &CscMatrix::try_new(1, 1, vec![0, 1], vec![0], vec![f64::MIN_POSITIVE]).unwrap(),
            &[f64::MAX],
        ),
        Err(MatrixError::NonFiniteResult),
    );
}
