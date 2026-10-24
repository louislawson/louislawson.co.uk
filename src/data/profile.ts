import { parseProfile } from "../content/schema";
import dragMeet from "../assets/garage/drag_meet.jpg";
import steamRally from "../assets/garage/steam_rally.jpg";
import truckShow from "../assets/garage/truck_show.jpg";

// Louis’s profile. A value still marked TODO: is shown hatched on previews and left out of production
// The data is parsed on import, so a mistake fails `npm run build`, not only `astro check`.
export const profile = parseProfile({
  roleLine:
    "Third-line service desk engineer, moving into cloud and DevOps on Azure.",
  intro:
    "I build the tools and systems a business runs on, from an API hosted on Azure to the scripts that retire a manual process. The work I enjoy most is replacing repetitive work with code.",
  careerLine:
    "Five and a half years in IT, across managed service providers and in-house IT in logistics.",
  // A region only, never a town or an address.
  region: "North East UK",
  // `until` is the last day the statement is true, as YYYY-MM-DD (UK time): it is hidden after that.
  availability: {
    text: "Not available",
    until: "2027-03-01",
  },
  email: "hello@louislawson.co.uk",
  links: {
    github: "https://github.com/louislawson",
    linkedin: "https://www.linkedin.com/in/louis-lawson-0767363b9",
  },
  cv: "TODO: set to /cv.pdf once public/cv.pdf exists",
  skills: [
    {
      group: "APIs and automation",
      context:
        "Built a customer-facing API that generates shipping labels across more carriers, and a PowerShell module that replaced a manual data upload between two platforms.",
      tools: ["Python", "FastAPI", "Docker", "PowerShell"],
      runs: [],
    },
    {
      group: "Azure and infrastructure as code",
      context:
        "Deployed that API to Azure App Service from Azure Container Registry, and built this site's hosting in Terraform with GitHub Actions.",
      tools: [
        "Azure App Service",
        "Azure Container Registry",
        "Terraform",
        "GitHub Actions",
      ],
      runs: ["R04"],
    },
    {
      group: "Identity and access",
      context:
        "At a managed service provider: planned and implemented Entra ID Privileged Identity Management with just-in-time access, now the blueprint for every customer that needs it, and replaced a failed domain controller.",
      tools: ["Entra ID", "Privileged Identity Management", "Active Directory"],
      runs: [],
    },
    {
      group: "Device management",
      context:
        "Reworked Intune onboarding from about two hours a device to twenty minutes, and automated Android kiosks: an enrolment profile puts each device in a multi-app kiosk group, and a Microsoft Form onboards or wipes a device through Power Automate and Microsoft Graph.",
      tools: ["Intune", "Power Automate", "Microsoft Graph"],
      runs: [],
    },
    {
      group: "Backup, patching and compliance",
      context:
        "Implemented Veeam backups with copies on site, off site and in the cloud, tested quarterly by restoring a lost virtual machine. For my employer's Cyber Essentials Plus renewal, automated Dell Command Update and Windows updates, so every company device came back into compliance where patching had been manual.",
      tools: ["Veeam", "Dell Command Update", "Windows Update"],
      runs: [],
    },
    {
      group: "Migrations",
      context:
        "Moved about 5-6 TB from an on-premises file server to SharePoint for about 160 users: reworked the structure with department managers, migrated with the SharePoint Migration Tool, gave access through Group Policy, and ran the user communication and training.",
      tools: ["SharePoint", "SharePoint Migration Tool", "Group Policy"],
      runs: [],
    },
  ],
  exploring: [
    "Studying for SC-900, Security, Compliance, and Identity Fundamentals",
    "Studying for AZ-104, Azure Administrator",
    "Terraform for Azure infrastructure",
    "Policy as code beyond Azure Policy",
    "CAN bus reverse engineering",
  ],
  certifications: [
    {
      title: "Microsoft Certified: Azure Fundamentals (AZ-900)",
      issuer: "Microsoft",
      date: "2026-07",
      verify:
        "https://learn.microsoft.com/api/credentials/share/en-us/LouisLawson-6460/749389C6C8673876?sharingId=4D33CE413E567BCF",
    },
  ],
  garageIntro:
    "Off the clock it's cars, trucks, tractors, and steam power: the machines that got me interested in how things work. Below, photos from shows and meets.",
  // A photo is imported from src/assets/garage/ with its metadata stripped, and its caption names
  // the event and the vehicle, never the owner. The placeholders are short so a hatched one fits.
  garage: [
    {
      name: "cars",
      note: "Coke-bottle styling and raw V8 power",
      photo: dragMeet,
      alt: "A 1972 Dodge Charger in lime green ready for a drag race.",
      caption: "Melbourne Raceway, 1972 Dodge Charger",
    },
    {
      name: "steam",
      note: "Our industrial heritage; coal and steam",
      photo: steamRally,
      alt: "A 1913 John Fowler K7 ploughing engine.",
      caption: "Yorkshire Traction Engine Rally, 1913 Fowler K7",
    },
    {
      name: "trucks",
      note: "Haulage with style, and V8 power",
      photo: truckShow,
      alt: "A 2024 Scania 770ST V8 in candy red, ready to haul.",
      caption: "TruckFest Lincoln, 2024 Scania 770ST V8",
    },
  ],
});
