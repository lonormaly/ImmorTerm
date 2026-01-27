# Pexit Aesthetics - Project-Specific

> Extends global `~/.claude/AESTHETICS.md` with Pexit-specific guidance.

## Brand Context

Pexit is an AI creator platform - think Shopify for AI visual artists. The aesthetic should:
- Feel premium and creative (not corporate SaaS)
- Appeal to photographers, AI artists, visual creators
- Balance "tool" functionality with artistic expression

## Theme Direction

**Primary aesthetic:** Dark, creative-tool inspired
- Reference: Figma, Adobe Creative Cloud, Midjourney
- Dark backgrounds with vibrant accents
- Photography/visual art context awareness

**Color palette hints:**
- Deep darks (#0a0a0f, #121218) not pure black
- Accent colors should feel "creative" - avoid corporate blues
- Consider gradients that evoke photography/light

## Typography for Pexit

**Recommended pairings:**
- Display: Clash Display, Syne, or Cabinet Grotesk
- Body: DM Sans, Outfit, or Manrope
- Code/Technical: JetBrains Mono, Fira Code

## Component Patterns

When building Pexit UI:
1. Use existing `@pexit/ui` components when available
2. Dark mode should be the primary/default
3. Image-heavy interfaces need careful loading states
4. Pack builder needs drag-drop visual feedback
5. Generation progress needs engaging animations

## Quick Reference

| Element | Pexit Direction |
|---------|----------------|
| Background | Dark, depth layers |
| Primary action | Vibrant gradient or accent |
| Cards | Subtle borders, glass effects |
| Images | Rounded corners, hover zoom |
| Loading | Skeleton with shimmer, not spinners |
