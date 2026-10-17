# Microsoft's Static Web Apps deployment client (StaticSitesClient), the code that the
# Azure/static-web-apps-deploy action wraps. Pinned by digest, so every deploy runs a build that
# went through review; Dependabot's docker entry proposes each new digest of the tag.
FROM mcr.microsoft.com/appsvc/staticappsclient:stable@sha256:f04ad21456c71d0938dfd7f031a8906abe8c5ccaa7724472df5f4a653bc00684

# The same working directory and command as the action's entrypoint script.
WORKDIR /bin/staticsites
ENTRYPOINT ["/bin/staticsites/StaticSitesClient"]
