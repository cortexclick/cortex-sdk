# Cortex SDK

An AI accelerated go-to-market (GTM) platform. Easily automate sales and marketing workflows from top of funnel content, to point of sale, support, and expansion.

Import your knowledgebase (markdown, json, text, html, etc), configure specialized AI agents called `cortexes`, and access them programmatically within your existing GTM workflows.

1. Index and organize your data in `catalogs`
2. Configure `cortexes`, agents specialized in generating high quality content including blog posts, SEO optimized landing pages.
3. Programmatically generate content through the API and SDK.

```ts
// example
```

## Common Scenarios

1. Generate SEO optimized blog posts, landing pages, and FAQs.
2. Support bots for slack, zendesk, and other tools.
3. Generating and sending marketing emails.
4. Tools to automate sales tasks like RFP geneartion

# Running Tests

This repo uses `vitest` to run tests.

**NOTE**: some of these test hit Cortex Click endpoints for content and chat generation that consume credits.

To run tests you'll need to set the following environment variables:

1.  `CORTEX_ORG`: The name of your Cortex Click org. Tests will be run under this account.
1.  `CORTEX_ACCESS_TOKEN`: The access token (org or personal) used to authenticate with the Cortex API.

There are two test targets:

1. `npm run test` run the full suite of test in watch mode
2. `npm run test:fast` a faster version of the suite that skips longer running tests (like content generation).
