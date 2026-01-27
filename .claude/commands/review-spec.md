---
description: Check that implementation aligns with the specification
---

# Review Spec Alignment

Check that implementation aligns with the specification.

## Instructions

1. **Load Specification**
   - Read the spec at `specs/[current]/spec.md`
   - Note all acceptance criteria and requirements
   - Identify edge cases mentioned in the spec

2. **Analyze Implementation**
   - Read the implemented code referenced in the plan
   - Check for each acceptance criterion being met
   - Verify edge cases are handled

3. **Check Consistency**
   - Run `/speckit.analyze` for cross-artifact consistency
   - Identify any drift between spec and implementation
   - Flag any requirements that were skipped or modified

4. **Report Findings**
   - List requirements that are fully implemented
   - List requirements with partial implementation
   - List requirements not yet implemented
   - Note any implementation that wasn't in the spec

## When to Use

- Before creating a PR for a feature
- When resuming work after a break
- When another developer asks about feature status
- During code review to verify completeness

## Output Format

```
## Spec Review: [Feature Name]

### Implemented
- [x] Requirement 1
- [x] Requirement 2

### Partial
- [ ] Requirement 3 - Missing edge case handling

### Not Implemented
- [ ] Requirement 4

### Implementation Drift
- Added X that wasn't in spec (document or remove)
```
