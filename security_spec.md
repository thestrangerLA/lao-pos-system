# Security Specification for POS App

## Data Invariants
1. A Product must have a non-negative price and stock.
2. A Sale must have at least one item and the total must match the calculated sum of items.
3. Every write must be authenticated.

## The "Dirty Dozen" Payloads (Denial Tests)

### Products Collection
1. **P1: Resource Poisoning** - Attempting to inject a huge string into the `name` field.
2. **P2: Invalid Type** - Sending `price` as a string instead of a number.
3. **P3: Missing Required Field** - Creating a product without a `category`.
4. **P4: Negative Numbers** - Setting `stock` to -100.
5. **P5: ID Poisoning** - Using a very long and illegal character string as a document ID.

### Sales Collection
6. **S1: Total Mismatch** - Creating a sale where `total` does not equal `subtotal - discount`.
7. **S2: Identity Spoofing** - (N/A currently as we don't have user-specific ownership yet, but will enforce auth).
8. **S3: Negative Discount** - Sending a negative discount value.
9. **S4: Invalid Enum** - Setting `paymentMethod` to "bitcoin".
10. **S5: Orphaned Sale** - (N/A for now).
11. **S6: PII Leak** - (N/A as we don't store PII yet).
12. **S7: Admin Escalation** - Attempting to change a protected field if it existed.

## Test Runner (Logic Check)
We will verify that these payloads return `PERMISSION_DENIED`.
