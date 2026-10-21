// html-validate's configuration: `npm run validate:html` checks every HTML file in both e2e builds
// (dist-e2e/preview and dist-e2e/production). Every rule relaxed from the recommended preset has
// its reason beside it.
export default {
  extends: ["html-validate:recommended"],
  rules: {
    // `role="list"` is deliberate on the two lists the reset styles with `list-style: none`
    // (certifications and skills): Safari with VoiceOver stops announcing such a list as a list
    // unless the role is stated, and tests pin the role. Any other redundant role still fails.
    "no-redundant-role": ["error", { exclude: ["list"] }],

    // A style rule about diffs, applied to generated output. It fires only on the ASCII wheel in
    // the garage `<pre>`, whose renderer pads every line to the same width.
    "no-trailing-whitespace": "off",
  },
};
