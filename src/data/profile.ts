import { parseProfile } from "../content/schema";

// Everything here is a TODO: placeholder until Louis supplies it, except the email, which is
// already public. A placeholder is shown hatched on previews and left out of production.
// The data is parsed on import, so a mistake fails `npm run build`, not only `astro check`.
export const profile = parseProfile({
  roleLine: "TODO: role line, for example the job title and focus",
  intro: "TODO: a short introduction in the first person",
  careerLine: "TODO: career in years and sectors, naming no employer",
  // A region only, never a town or an address.
  region: "TODO: region",
  // `until` is the last day the statement is true, as YYYY-MM-DD (UK time): it is hidden after that.
  availability: {
    text: "TODO: status",
    until: "TODO: date",
  },
  email: "hello@louislawson.co.uk",
  links: {
    github: "TODO: GitHub URL",
    linkedin: "TODO: LinkedIn URL",
  },
  cv: "TODO: set to /cv.pdf once public/cv.pdf exists",
  skills: [
    {
      group: "TODO: skill group",
      context: "TODO: one anonymised line on where you have used it",
      tools: ["TODO: tools"],
      runs: [],
    },
  ],
  exploring: ["TODO: something you are exploring next"],
  certifications: [
    {
      title: "TODO: certification or milestone",
      issuer: "TODO: issuer",
      date: "TODO: date",
    },
  ],
  garageIntro: "TODO: garage intro",
  // A photo is imported from src/assets/garage/ with its metadata stripped, and its caption names
  // the event and the vehicle, never the owner. The placeholders are short so a hatched one fits.
  garage: [
    {
      name: "TODO: cars",
      note: "TODO: a line on cars",
      photo: "TODO: photo",
      alt: "TODO: describe the photo",
      caption: "TODO: event and vehicle",
    },
    {
      name: "TODO: trucks",
      note: "TODO: a line on trucks",
      photo: "TODO: photo",
      alt: "TODO: describe the photo",
      caption: "TODO: event and vehicle",
    },
    {
      name: "TODO: tractors",
      note: "TODO: a line on tractors",
      photo: "TODO: photo",
      alt: "TODO: describe the photo",
      caption: "TODO: event and vehicle",
    },
  ],
});
