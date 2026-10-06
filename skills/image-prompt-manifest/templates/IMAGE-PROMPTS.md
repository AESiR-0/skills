# Image prompts: <project>

Generate each image, then save it at exactly the path in its entry. The site already points at
these paths, so a saved file shows up with no code change. Tell me when files have landed and I
will check sizes and wiring.

Tool: <the generator you use, e.g. Gemini / Nano Banana, gpt-image, Midjourney>.
Generate one at a time; approve the first before doing the rest.

## Rules for every prompt

**House style (paste before every prompt):**
> <one paragraph: medium, lens or rendering style, lighting, grain, mood, palette with hex
> values. The same block on every prompt keeps the set coherent.>

**Negative prompt (every prompt):**
> no text, no lettering, no signage, no logos, no watermarks, no brand names, no UI, no
> borders, no frames, <project-specific avoids>

**Export:** <JPG sRGB quality ~85 | PNG for alpha | WebP>, under <300> KB at the stated size.

## Do not generate

| Slot | Why |
|---|---|
| `<path>` | <real product photo exists / real person / frame from the actual video> |

---

## 1 · <Slot name>

**Path** `public/<folder>/<file>.jpg` · **16:9** · **1600 × 900**

Used on: <page and section>. <Crop and overlay notes, e.g. "the title sits over the bottom
third, keep it quiet and dark"; "also cropped to 1:1 on mobile, keep the subject centred">.

```
<prompt: subject, composition, framing, light, palette; states the aspect ratio in words>
```

---

## Checklist

- [ ] 1 · <Slot name> · `public/<folder>/<file>.jpg`
