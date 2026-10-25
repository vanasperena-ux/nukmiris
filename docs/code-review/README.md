# NukMiris code walkthrough

[Open the plain-text walkthrough](NukMiris-v0.7.3-Code-Walkthrough.txt).

It explains **v0.7.3** at the exact [GitHub source snapshot `2d69b62`](https://github.com/vanasperena-ux/nukmiris/commit/2d69b6257064982e1b9b295186eb8ff12cfcbbd5), verified as `main` when this review began on October 25, 2026 (America/Mexico_City).

After this review, the owner confirmed **“version v0.7.3 tested and all good”**. v0.7.3 is now the current owner-verified baseline; see [the verification record](../../backend/BASELINE.md). The walkthrough includes this update while preserving its numbered source and historical snapshot-time status.

The document contains 36 complete application, configuration, utility and website files: 4,726 original source lines in 225 explained blocks. Each block includes its original file/line range, numbered source, a plain-language explanation and a link to those lines in the fixed GitHub snapshot. The introduction provides a topic index, a suggested reading order, a booking journey and a small glossary. Tests have a separate reading map.

For example, in `backend/whatsapp-webhook.js`:

| Original lines | Purpose |
| --- | --- |
| 95–122 | Select the correct business and connect its services |
| 123–144 | Store the customer's conversation step |
| 145–160 | Identify and register the customer for that business |
| 289–303 | Validate names and reject invalid input |
| 1513–1523 | Return to the main menu |
| 1639–1668 | Handle a new customer's name and continue booking |

Line numbers restart for each source file; they are not the positions in the text document. Retained disabled code is marked **LEGACY** so its old defaults and confirmation screens are not confused with the current implementation. Use the topic/file indexes or Find to navigate the full reading copy.

Every reproduced source line was checked against Git, with complete contiguous coverage of each included file. Local credentials, actual environment settings, customer databases, screenshots, installed dependencies and old handoff archives are excluded. The application remains v0.7.3; this is a documentation update, with no application changes or new PC testing required.
