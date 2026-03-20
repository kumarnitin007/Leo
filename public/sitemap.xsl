<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">

  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>Leo Planner — Sitemap</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 2rem 1.25rem 3rem;
            background: linear-gradient(160deg, #f0fdfa 0%, #e0f2fe 45%, #f5f3ff 100%);
            color: #1f2937;
            line-height: 1.5;
          }
          .wrap { max-width: 880px; margin: 0 auto; }
          h1 {
            font-size: 1.75rem;
            margin: 0 0 0.35rem 0;
            color: #0f766e;
          }
          .sub {
            color: #6b7280;
            font-size: 0.95rem;
            margin: 0 0 1.75rem 0;
          }
          .note {
            background: rgba(255,255,255,0.85);
            border: 1px solid #99f6e4;
            border-radius: 12px;
            padding: 1rem 1.15rem;
            margin-bottom: 1.5rem;
            font-size: 0.875rem;
            color: #475569;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(15, 118, 110, 0.12);
          }
          th, td {
            text-align: left;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #e5e7eb;
            font-size: 0.875rem;
          }
          th {
            background: #14b8a6;
            color: #fff;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-size: 0.7rem;
          }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background: #f9fafb; }
          a { color: #0d9488; font-weight: 500; word-break: break-all; }
          a:hover { text-decoration: underline; }
          .prio { font-variant-numeric: tabular-nums; color: #64748b; }
          .freq { color: #64748b; }
          footer {
            margin-top: 2rem;
            font-size: 0.8rem;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1>🦁 Leo Planner — XML Sitemap</h1>
          <p class="sub">Human-friendly view of <code>sitemap.xml</code>. Search engines read the raw XML; this page is optional.</p>
          <div class="note">
            <strong>Why the plain XML warning?</strong> Browsers show “no style information” for raw XML.
            This stylesheet only affects how <em>you</em> see the file in a browser — Google still uses the standard sitemap format.
          </div>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Last modified</th>
                <th>Change freq</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url">
                <tr>
                  <td>
                    <a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a>
                  </td>
                  <td>
                    <xsl:choose>
                      <xsl:when test="sm:lastmod"><xsl:value-of select="sm:lastmod"/></xsl:when>
                      <xsl:otherwise>—</xsl:otherwise>
                    </xsl:choose>
                  </td>
                  <td class="freq">
                    <xsl:choose>
                      <xsl:when test="sm:changefreq"><xsl:value-of select="sm:changefreq"/></xsl:when>
                      <xsl:otherwise>—</xsl:otherwise>
                    </xsl:choose>
                  </td>
                  <td class="prio">
                    <xsl:choose>
                      <xsl:when test="sm:priority"><xsl:value-of select="sm:priority"/></xsl:when>
                      <xsl:otherwise>—</xsl:otherwise>
                    </xsl:choose>
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
          <footer>
            Leo Planner · <a href="https://leo-planner.vercel.app/">Home</a>
            · <a href="/features.json"><code>features.json</code></a>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
