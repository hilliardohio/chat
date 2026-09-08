/**
 * Hilliard Assistant — Cloudflare Worker backend
 *
 * Holds the Claude API key server-side so the public chat page never sees it.
 * Also serves a password-protected /admin page (enter key, customize topics,
 * edit the knowledge base, view/download the central Q&A log).
 *
 * SETUP (see SETUP.md): create a Worker, paste this file, add a KV namespace
 * binding named KV, and a secret named ADMIN_PASSWORD. Optional env vars:
 *   ALLOWED_ORIGIN      e.g. "https://yourname.github.io"  (default: *)
 *   GLOBAL_DAILY_LIMIT  max chat requests/day, default 500
 *   IP_HOURLY_LIMIT     per-visitor hourly cap, default 30
 *   OPENGOV_API_KEY     OpenGov Permitting & Licensing integration key (secret).
 *                       When set, zoning letters include the property's real
 *                       permit history pulled live from OpenGov. When absent or
 *                       invalid, letters fall back to the portal search link.
 *                       Generate at developer.opengov.com → Integrations →
 *                       API Key tab, with read access to Records and Locations.
 */

const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 2600; // headroom so a full zoning letter is never cut off mid-sentence

/* ---------------- knowledge base (editable later in /admin) ---------------- */
const DEFAULT_KB = "CITY OF HILLIARD, OHIO — KNOWLEDGE BASE (compiled Aug 25, 2026 from hilliardohio.gov and the Hilliard Code of Ordinances on Municode, Supplement 10, codified through Ord. 25-28, Oct 27, 2025)\n\n== CONTACT & BASICS ==\nCity Hall/Administration: 3800 Municipal Way, Hilliard, OH 43026 — (614) 876-7361. Business hours approx. 8am–5pm weekdays.\nWebsite: hilliardohio.gov. General questions: \"Ask Us\" form at hilliardohio.gov/contact-the-city/ (~48-hr response).\nService requests (potholes, chipper, signs, etc.): Hilliard Helps / Hilliard 311 — hilliardohio.gov/hilliardhelps/, (614) 876-7361 ext. 311.\nPolice: 5171 Northwest Parkway. Emergency 911; NON-EMERGENCY (614) 876-7321 (24/7). Records: (614) 876-2429, hpdrecordsunit@hilliardohio.gov.\nFire: provided by NORWICH TOWNSHIP (not the City) — 5181 Northwest Parkway, (614) 876-7694.\nMayor's Court: 5171 Northwest Parkway, Wednesdays 8am; Clerk (614) 334-2348; pay tickets at ohioticketpayments.com/Hilliard/DocketSearch.php.\nThe Well (rec & wellness campus): 3993 Cosgray Rd, (614) 876-5200.\nCity Code: library.municode.com/oh/hilliard/codes/code_of_ordinances.\n\n== GOVERNMENT ==\nHilliard has a COUNCIL–MANAGER government — NO elected mayor. Seven at-large council members appoint a City Manager.\nCity Manager: Joshua Rauch (sworn in April 20, 2026).\nCouncil: Emily Cole (President), Tina Cottone (VP), Greg Betts, Kathy Parker-Jones, Nadia Atway Rasul, Andy Teater, Cynthia Vermillion. Contact: CityCouncil@hilliardohio.gov. Clerk of Council: Diane Werbrich, (614) 334-2365.\nRegular Council meetings: 6pm, 2nd & 4th Mondays, Council Chambers, 3800 Municipal Way (time changed from 7pm effective Aug 25, 2026). Agendas/minutes: hilliardohio.civicweb.net/Portal/. Speakers sign in with the Clerk; 3 minutes each.\nBoards/commissions: Planning & Zoning Commission, Board of Zoning Appeals, Environmental Sustainability, Public Arts, Shade Tree, Records Commission, and others.\n\n== TRASH, RECYCLING & YARD WASTE ==\nProvider: Local Waste Services (LWS) under city contract. Trash, recycling AND yard waste all collected EVERY TUESDAY citywide.\nHoliday rule: holiday on Sun/Mon/Tue pushes pickup to Wednesday; Saturday holidays cause no delay.\nContainers out by 7am at end of driveway (not in the street), max 50 lbs. By code (Ch. 975): set out no earlier than 5pm the day before; bring in by 9am the morning after; store containers behind the house or not forward of the front face of the dwelling.\nBins: blue recycling + green/gray trash (65-gal standard). Larger 90-gal recycling bin FREE from LWS (614-409-9375); larger trash bin $65 via City (614-334-1209).\nBilling: quarterly by LWS; pay at localwasteservices.com; unpaid bills can become a property lien. Senior (65+) discount: 10% (Ch. 975.06) — apply through LWS, info@localwasteservices.com.\nMissed pickup: LWS (614) 409-9375 option 2, within 24 hours. City trash line: (614) 334-1209.\nBulk items: with regular trash at curb; upholstered items (mattresses/box springs/furniture) MUST be wrapped in plastic. Large pickups scheduled via LWS.\nRecyclables loose, never bagged. Guidance: recycleright.org, swaco.org.\nYard waste: Tuesdays Mar 1–Nov 30, in brown paper bags or rigid containers with free yard-waste stickers (get at 3800 Municipal Way). Bundles max 4ft x 2ft, branches ≤2in diameter, ≤50 lbs. Christmas trees collected bare.\nChipper (City, on-demand): limbs over 4 ft long/4 in diameter; Mondays mid-April–late Sept; request via Hilliard Helps by 2:30pm the prior Friday.\nComposting: GoZero program. Styrofoam recycling available — see hilliardohio.gov.\n\n== WATER, SEWER & UTILITIES ==\nThe City does NOT provide water/sewer. COLUMBUS Division of Water serves Hilliard: start/stop service & billing (614) 645-3111 or columbus.gov utilities pages.\nStorm/sanitary sewer infrastructure inside the city: Hilliard Engineering; issues → Hilliard 311.\nElectric: AEP Ohio (lines/outages); city electric aggregation supplied by Dynegy (hilliardohio.gov/aggregation/). Gas: Columbia Gas of Ohio.\nCall OUPS (oups.org) at least 48 hrs before digging.\n\n== INCOME TAX ==\nRate: 2.5% (since Jan 1, 2022). ALL residents 18+ must file a city return every year by April 15 — even if nothing is owed — EXCEPT seniors with no earned income. Filed through RITA (ritaohio.com); checks payable to RITA.\nFull credit for tax paid to a work city, up to 2.5%. Retirement income, unemployment not taxed.\nCity Income Tax Division: (614) 876-7361 ext. 778, Tax1@hilliardohio.gov.\nPROPERTY taxes: Franklin County Auditor (614) 525-4663 — not the City.\n\n== PERMITS, BUILDING & CONTRACTORS ==\nApply and pay ONLINE via the OpenGov portal: hilliardoh.viewpointcloud.com (a.k.a. hilliardoh.portal.opengov.com). An application is NOT a permit — wait for issuance before building.\nPermits required for (examples): decks, sheds, fences, basement finishes, additions, roofs, driveways, patios, pools, hot tubs, electrical, plumbing, furnace replacement, siding.\nReview: about 2 weeks typical; most permits valid 1 year. Contact: Building@hilliardohio.gov.\nAll contractors must be REGISTERED with the Building Department. Homeowners may do their own work on their own residence (not rentals) — permits/inspections still required.\nZoning applications (zoning certificate, sign permit, fence permit, BZA, zoning verification letter): Planning Division, Planning1@hilliardohio.gov, OpenGov portal.\nReport a code/zoning violation: hilliardohio.gov/report-a-code-violation/.\nSidewalk repair: adjacent property owner's responsibility (City repairs curb ramps and damage from city-tree roots).\n\n== CITY CODE HIGHLIGHTS (cite section numbers) ==\nPARKING: No vehicle parked on any street more than 72 continuous hours (§351.14). Commercial vehicles max 1 hr on street; RVs/trailers max 2 hrs on street (§351.22), delivery/loading excepted. No general citywide overnight parking ban — but obey posted signs and permit districts (§§351.23–.24). Snow emergency (declared when 3+ inches forecast): no parking on designated snow-emergency streets, vehicles may be towed (Ch. 352).\nNOISE: Quiet hours 10pm–7am (§531.02) — no loudspeakers, loading, or powered lawn/garden equipment that disturbs neighbors (snow-removal equipment exempt). Residential sound limits roughly 60 dBA day / 50 dBA night (§531.03). CONSTRUCTION: no exterior construction work on Sundays or between 7pm and 7:30am (§509.08).\nANIMALS: Max 4 dogs/cats total per household (excl. under 4 months) (§505.06). Dogs must be confined/leashed or under reasonable control (§505.02); annual dog license via Franklin County (§505.09). CHICKENS (§1121.08): only in R-R, R-1, R-2, PUD, HCD districts; lots UNDER 0.5 acre → NOT allowed; 0.5–2.99 acres → up to 6; coop rear yard only, 15 ft from property lines; zoning certificate + fence permit required. Roosters/ducks only on 1+ acre. Beekeeping per §1121.09 (flyway barrier rules). Livestock only in R-R on 3+ acres (§1121.07).\nGRASS/WEEDS: max 6 inches (§1303.02, Ch. 917). 5-day notice to cut; City may mow and assess costs as a tax lien; min $250 fine (§917.99).\nJUNK VEHICLES: inoperable vehicles/equipment may not sit outside an enclosed building more than 48 hours (§1121.05).\nFENCES (§1121.02(d)): PERMIT REQUIRED. No front-yard fences (invisible fences excepted; limited corner-lot exception). Max 6 ft side/rear; chain-link max 4 ft in residential. Neutral colors; finished side out; no barbed wire/stockade/electric/scrap materials. Pools must be fenced (4–6 ft, self-latching gate) or have a locking safety cover.\nSHEDS/ACCESSORY BUILDINGS (§1121.02(b)): rear yard only; ≥6 ft from rear and ≥3 ft from side lot lines; max 14 ft tall; max 50% of the home's floor area or 900 sq ft, whichever is less; ≤30% of required rear yard.\nSIGNS (Ch. 1129): NO signs in any public right-of-way, on utility poles, street signs, trees, or public property. Garage/yard-sale signs allowed without permit on private property only. Real-estate signs: one, max 8 sq ft, 4 ft high, removed within 7 days of closing. No separate political-sign rules — same content-neutral rules apply (keep on private property, out of right-of-way).\nGARAGE SALES (Ch. 727): max 2 per residence per 12 months, max 3 consecutive days; hours 9am–8pm (Apr–Sep) / 9am–6pm (Oct–Mar).\nFIREWORKS (Ch. 1519): discharge of consumer fireworks is PROHIBITED citywide (Hilliard opted out of Ohio's holiday-discharge default). Licensed public exhibitions only. First-degree misdemeanor, fine up to $1,000.\nCURFEW (Ch. 539): under 12 — darkness to dawn; under 18 — midnight to 6am. Exceptions: with parent/guardian, parent-directed errand, work travel, newspaper delivery.\nHOME OCCUPATIONS (§1121.06(e)): permit from Planning Director required; business entirely inside the dwelling; residents only; max 25% of floor area or 250 sq ft; no on-site retail sales; no exterior evidence except one 2-sq-ft non-illuminated sign.\nSIDEWALK SNOW: abutting property owners are responsible for clearing snow and ice from sidewalks/paths next to their property (§909.02(i)).\nTRASH STORAGE: solid waste kept max 14 days (§975.02); container set-out/bring-in rules in §975.05 (see trash section).\nZONING DISTRICTS (§1104.01): 16 districts — R-R, R-1, R-2, R-3, R-4 residential; B-1–B-4 business; M-1, M-2 industrial; S-1, HCD, OH-MD, OH-RD special; PUD planned.\n\n== ZONING DISTRICT STANDARDS (Chs. 1109–1117; use with the lookup_zoning tool for address questions) ==\nEvery district is also subject to Ch. 1121 general provisions (accessory buildings, fences, home occupations, chickens), Ch. 1123 conditional uses, Ch. 1127 parking, Ch. 1129 signs. \"P\"=permitted, \"C\"=conditional use (needs approval).\nR-R Rural Residential: large-lot single-family without public utilities; farms/stables C. Min lot 100,000 sq ft / 150 ft wide; height 35 ft; setbacks front 40 / side 15 (35 total) / rear 40; coverage 25%. Only district allowing agricultural animal uses broadly.\nR-1 Low Density: single-family P; schools/worship/B&B C. Min lot 13,500 sq ft / 90 ft (30,000 sq ft if no public water/sewer); height 35; front 35 / side 12 (30 total) / rear 40; coverage 30%.\nR-2 Low/Medium Density: single-family P. Min lot 11,200 sq ft / 80 ft; height 35; front 25 for the dwelling BUT garages must sit back 35 ft (unique to R-2); side 10 (20 total) / rear 35; coverage 30%.\nR-3 Moderate Density: single-family P; two-family, townhouses, CCRC, day care center C. Min lot 10,000 sq ft / 70 ft (two-family 6,000 sq ft/unit); height 35; front 30 / side 10 (20 total) / rear 30; coverage 35%.\nR-4 High Density: detached/attached/multi-family P. Min lot 6,000 sq ft / 60 ft; multi-family max 14 units/acre; height 35 (up to 70 with extra setbacks); front 30 / side 8 (16 total) / rear 30; coverage 35%.\nB-1 Neighborhood Business: small-scale convenience retail/services, small restaurants (<2,000 sq ft, no drive-thru), offices, banks P; bars, general retail, drive-thrus C. Min lot 7,500 sq ft / 60 ft; height 35; front 30 / side 0 / rear 20.\nB-2 Community Business: general retail, restaurants, bars, hotels, offices P; vehicle sales/repair, drive-thru restaurants, outdoor storage C. Min lot 1 acre / 200 ft; height 35; parking 20 / building 50 front; side 20 / rear 30.\nB-3 Office/Institutional: offices, medical, labs, data centers, restaurants P; hospitals, colleges C; most retail excluded. Min lot 1 acre / 200 ft; height 45; building front 50; side 20 / rear 30.\nB-4 I-270 Corridor: offices, hotels, restaurants, retail <15,000 sq ft P; residential, grocery, drive-thrus C. Min lot 1 acre / 200 ft; height 70; building front 60 / side 30 / rear 30 (+1 ft setback per ft above 45 ft height).\nM-1 Restricted Industrial: light manufacturing, offices, research, data centers P; breweries, warehouses, self-storage, outdoor storage C. Min lot 1 acre / 100 ft; height 45; building front 50 / side 20 / rear 40; coverage 30%.\nM-2 General Industrial: manufacturing, warehouses/distribution P; chemical plants, truck repair, recycling C. Min lot 2 acres / 200 ft; height 45; building front 50 / side 30 / rear 40; coverage 50%.\nS-1 Support Facilities: parks, schools, worship, government, libraries (mostly C); no dwellings. Min lot 3 acres / 250 ft; height 45; building front 60 / side 50 (100 total) / rear 60; coverage 20%.\nHCD Hilliard Conservation District (Big Darby watershed): conservation development; min tract 20 acres, no min lot size, 70% permanent open space; standards set by development-plan review; height 35.\nOH-MD Old Hilliard Mixed Use (downtown): retail, restaurants, bars, offices, dwellings P. No min lot; height 52 ft; build-to zone 0–10 ft front; parking behind buildings. Exterior changes need P&Z design review (§1115.05); fences max 30 inches downtown.\nOH-RD Old Hilliard Residential: small-lot housing near downtown; all dwelling types P. Min lot 7,000 sq ft / 50 ft; height 35; front build-to 0–25 ft; side 5 (12 total) / rear 25. Exterior modifications need P&Z review.\nCOMMUNITY DEVELOPMENT DISTRICTS (Chapter 1116 — adopted by Ordinance 25-17, July 14, 2025; amended by Ordinance 26-07, March 23, 2026; not yet codified on Municode, so the governing text is the ordinance itself: https://library.municode.com/oh/hilliard/ordinances/code_of_ordinances?nodeId=1369718). These form-based districts implement the 2023 Hilliard Community Plan and are newer than the Chapter 1109–1117 districts above. They are: DE Big Darby Employment District (§1116.07), and the I-270 Corridor (I) District (§1116.08) with its subdistricts I-1 Natural, I-3 Suburban, I-6 Urban Core, I-FE Flex Employment, I-MR Mill Run, and Civic. Chapter 1116 also contains shared design standards and guidelines (§1116.02), building typologies (§1116.03), frontage typologies (§1116.04), open space typologies (§1116.05), and green parking typologies (§1116.06). Standards are set by building/frontage form rather than a conventional setback table; review is through Site Plan Review (Ch. 1131), except Big Darby Employment which follows §1116.07(h). For property-specific standards in these districts, refer the resident to the Planning Division.\nPUD Planned Unit Development: NEGOTIATED district — no fixed standards table. Each PUD is governed by its own Council-approved development text/plan (deviations from baseline district standards allowed). Pre-2014 PUDs keep their original approved plans. For any property in a PUD: the resident must check that PUD's approved text — the GIS lookup often returns a link to it; otherwise contact Planning (Planning1@hilliardohio.gov).\n\n== SNOW, STREETS & LEAVES ==\nSnowplow priority: 1) major arteries 2) minor arterials 3) residential streets (usually unsalted) 4) cul-de-sacs 5) lots/paths. Track plows live: SnowPaths — portal.snowpaths.com/public/983278/983279.\nDon't shovel snow into streets or around hydrants. Potholes/street lights: report via Hilliard 311.\nLeaf collection (curbside vacuum): Oct–Dec by color-coded quadrant (2026: Oct 20–Dec 19). Rake to the TREE LAWN (never the street) by 7am Monday of your zone's week. Bagged leaves also OK with Tuesday yard waste through Nov 30. Street sweeping roughly monthly (not winter).\n\n== PARKS & RECREATION ==\nThe Well: 3993 Cosgray Rd — fitness floor, indoor aquatics, gyms, indoor track, teaching kitchen, The Depot teen space; memberships & day passes; partner OSU Wexner Medical Center. (614) 876-5200.\nTwo outdoor pools: Hilliard Family Aquatic Center and Clyde \"Butch\" Seidle Community Pool — one pass valid at both; passes go on sale each January; prices at hilliardohio.gov/pools-passes/.\nNearly 27 parks incl. Roger A. Reynolds Municipal Park (shelter rentals $100/day, $50 nonprofit), Hilliard's Station Park (7-mile Heritage Trail trailhead), First Responders Park, Weaver Park.\nProgram registration: webtrac.hilliardohio.gov (also mobile app). Rentals: rentals@hilliardohio.gov, (614) 334-2580. 55+ programs (HSC 55+) at The Well; Hilliard Express senior transportation.\n\n== EVENTS ==\nAnnual: Independence Day Parade & Freedom Fest (July 4), Fall Festival (Sept 13, 2026), Heritage Day, Pumpkin Float, Beggar's Night/Trick-or-Treat (Oct 31 if Mon–Thu, else preceding Thursday; 2026: Oct 29, 6–8pm), Tree Lighting (Dec 6, 2026), Cram the Cruiser. Calendar: hilliardohio.gov/events/.\nDORA (outdoor drinks, Old Hilliard): 21+, daily noon–9pm (last call 8:30pm), designated cups from participating vendors only.\n\n== PROPERTY RECORDS & PERMIT LOOKUP (address-specific) ==\nPROPERTY DATA: The lookup_zoning tool returns Franklin County Auditor parcel data: owner, parcel size in acres, residence year built, last transfer date and price, property class, subdivision, homestead status. Cite it as Franklin County Auditor data. FULL property records (appraised value, property taxes, transfer history, photos, sketches): Franklin County Auditor property search — property.franklincountyauditor.com (search by address under 'Address' mode). Bulk/GIS property data: the Auditor's Data Library at auditor.franklincountyohio.gov/Auditor/FTP. Property tax questions: Franklin County Auditor (614) 525-4663 — NOT the City.\nPERMIT LOOKUP BY ADDRESS: Every active and historical permit issued for a Hilliard property can be viewed publicly at hilliardoh.portal.opengov.com/search — choose the 'Locations' tab, type the address, and select it; the property page lists all records (building, electrical, plumbing, HVAC, fence, sign, zoning applications, etc.) with their status. The assistant cannot pull these records directly; always give residents this link for permit-history questions.\nPERMIT APPLICATIONS & ZONING VERIFICATION: hilliardoh.portal.opengov.com is the City's permitting portal (OpenGov, formerly ViewPoint Cloud) — apply for permits, pay fees, track your own applications, schedule inspections, request zoning verification letters (Planning & Zoning category), and request addresses. Create a free account to apply. Directions and record-type categories are on the portal home page. Portal help: Building@hilliardohio.gov (building permits) or Planning1@hilliardohio.gov (zoning/planning).\n\n== PUBLIC RECORDS ==\nNo ID, writing, or reason required. Email publicrecords@hilliardohio.gov or Clerk of Council (614) 334-2365. Police records: hpdrecordsunit@hilliardohio.gov, (614) 876-2429, online form, or in person 24/7.\nCopies 5¢/page; emailed records free; no charge if under $20.\n\n== JOBS ==\nApply ONLY online: governmentjobs.com/careers/cityofhilliard. No residency requirement. Seasonal jobs (lifeguards, camps) via Rec & Parks. HR: (614) 334-1397. Police hiring: hilliardohio.gov/join-the-hpd-team/.\n\n== KNOWN LIMITS (be transparent about these) ==\nCurrent prices/fees (pool passes, Well memberships, permit fees, program fees) change — direct people to the live page or phone number instead of quoting numbers. Leaf-zone quadrant boundaries are on a PDF map on the leaf page. Fire/EMS is Norwich Township. Property tax is Franklin County. School questions → Hilliard City Schools district (separate from City).\n\n== SPECIFIC CITY WEBSITE PAGES (link residents to the EXACT page below, not the generic homepage) ==\nRecycling: hilliardohio.gov/recycling/\nComposting / food waste / GoZero: hilliardohio.gov/composting-program/\nTrash & recycling (overview): hilliardohio.gov/trash-recycling/\nYard waste: hilliardohio.gov/yard-waste/\nLeaf collection: hilliardohio.gov/leaf-collection/\nStyrofoam recycling: hilliardohio.gov/styrofoam-recycling/\nPool passes & pools: hilliardohio.gov/pools-passes/\nIncome tax (RITA): hilliardohio.gov/taxes/\nSnowplow tracking (SnowPaths): hilliardohio.gov/snowpaths/\nStreet maintenance: hilliardohio.gov/street-maintenance/\nSidewalk maintenance: hilliardohio.gov/sidewalk-maintenance/\nStreet trees / tree program: hilliardohio.gov/trees/\nReport a code violation (info page): hilliardohio.gov/report-a-code-violation/\nService requests (Hilliard Helps / 311): hilliardohio.gov/hilliardhelps/\nPlanning & zoning: hilliardohio.gov/planning-zoning/\nPlanning Division: hilliardohio.gov/planning-division/\nBuilding Standards Division: hilliardohio.gov/building-standards-division/\nBoard of Zoning Appeals: hilliardohio.gov/zoning-appeals/\nEngineering Division: hilliardohio.gov/engineering-division/\nStormwater management: hilliardohio.gov/stormwater-management/\nSanitary sewer & stormwater: hilliardohio.gov/sanitary-sewer-and-stormwater-systems/\nPolice: hilliardohio.gov/police/\nPolice online reporting: hilliardohio.gov/onlinereporting/\nMayor's Court: hilliardohio.gov/mayors-court/\nPublic records: hilliardohio.gov/public-records/\nPolice records: hilliardohio.gov/police-public-records/\nContact the City / Ask Us: hilliardohio.gov/contact-the-city/\nCity Council: hilliardohio.gov/city-council/\nAgendas & minutes: hilliardohio.gov/agendas-minutes/\nBoards & commissions: hilliardohio.gov/boards-commissions/\nJobs / hiring: hilliardohio.gov/hiring/\nPolice hiring: hilliardohio.gov/join-the-hpd-team/\nNewsletter signup: hilliardohio.gov/newsletter-signup/\nAnnual events: hilliardohio.gov/annual-events/\nFall Festival: hilliardohio.gov/fallfestival/\nDORA (outdoor drinks): hilliardohio.gov/dora/\nElectric aggregation: hilliardohio.gov/aggregation/\nSustainability: hilliardohio.gov/sustainability/\nCommunity garden: hilliardohio.gov/community-garden/\nForms & applications: hilliardohio.gov/forms-and-applications/\nRec program guide: hilliardohio.gov/program-guide/\nRec registration: webtrac.hilliardohio.gov\nVacation house check: hilliardohio.gov/vacation-house-check/\nSmart911: hilliardohio.gov/smart911/\nMosquito control: hilliardohio.gov/mosquitos/\nKeep Hilliard Beautiful: hilliardohio.gov/keep-hilliard-beautiful/\n\n== PERMIT & LICENSE APPLICATION LINKS (OpenGov portal — give the EXACT application URL below when a resident wants to apply or asks about a permit type; an application is NOT a permit, wait for issuance) ==\nBuilding Permit - Residential (decks, sheds/accessory over 200 sq ft, additions, remodels, detached garages, basement finishing): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6395\nBuilding Permit - Commercial: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6468\nCommercial Plan Review (step 1 before a commercial building permit): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6502\nElectrical Permit (includes residential solar panels): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6511\nHVAC / Refrigeration Permit (furnace/AC replacement): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6513\nGas Line Permit: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6514\nRoofing Permit (commercial re-roof only; not required for 1-3 family homes): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6515\nFire Protection System Permit (sprinklers, fire alarm, hood suppression): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6512\nCommercial Kitchen Hood Permit: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6510\nDemolition Permit: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6520\nTemporary Structure / Tent Permit: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6516\nCertificate of Occupancy (existing structures): https://hilliardoh.portal.opengov.com/categories/1079/record-types/6517\nPlumbing Permits — now handled by Franklin County Public Health: https://hilliardoh.portal.opengov.com/categories/1079/record-types/6559\nFence Permit (includes swimming pool fences): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6460\nSign Permit (permanent): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6389\nSign Permit - Temporary (banners, feather flags, A-frames, real estate/construction signs): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6544\nZoning Certificate (certificate of zoning compliance): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6383\nZoning Verification / Confirmation Letter (official ZVL): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6376\nBoard of Zoning Appeals Application (variances, conditional use, home occupation): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6469\nPlanning & Zoning Commission Application (rezoning, site plans, plats, lot splits): https://hilliardoh.portal.opengov.com/categories/1080/record-types/6481\nAddress Request: https://hilliardoh.portal.opengov.com/categories/1080/record-types/6535\nTemporary Storage Unit (POD) registration: https://hilliardoh.portal.opengov.com/categories/1080/record-types/6536\nHotel/Motel or Bed & Breakfast: https://hilliardoh.portal.opengov.com/categories/1080/record-types/6519\nMassage or Bath Establishment: https://hilliardoh.portal.opengov.com/categories/1080/record-types/6518\nCurb, Driveway Approach & Sidewalk Permit: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6392\nRight of Way Permit: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6342\nWater & Sewer Taps: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6523\nSewer/Water Lateral Replacement or Repair: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6489\nSpecial Flood Hazard Area Development Permit: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6500\nCivil / Site Plan Review: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6534\nSanitary Backflow Device Program: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6539\nHauling Permit: https://hilliardoh.portal.opengov.com/categories/1084/record-types/6546\nReport a Code Violation (file a complaint): https://hilliardoh.portal.opengov.com/categories/1078/record-types/6375\nGrass / Weed Complaint: https://hilliardoh.portal.opengov.com/categories/1078/record-types/6538\nContractor Registration: https://hilliardoh.portal.opengov.com/categories/1086/record-types/6371\nSolicitor & Peddler Permit: https://hilliardoh.portal.opengov.com/categories/1074/record-types/6487\nFood Truck / Cart Permit: https://hilliardoh.portal.opengov.com/categories/1074/record-types/6484\nNeighborhood Block Party / Street Closure Permit: https://hilliardoh.portal.opengov.com/categories/1074/record-types/6492\nEvent Permit: https://hilliardoh.portal.opengov.com/categories/1074/record-types/6540\nCharitable/Religious/Political Canvassing Registration: https://hilliardoh.portal.opengov.com/categories/1074/record-types/6496\nBrowse all permit categories: hilliardoh.portal.opengov.com\n\n== ENGINEERING DESIGN & CONSTRUCTION STANDARDS (for engineering / design / construction questions) ==\nThe City's Engineering Design and Construction Standards govern how public and private infrastructure must be designed and built in Hilliard — the reference used by engineers, developers, and contractors on development and capital projects. Full manual: https://hilliard.municipalcodeonline.com/book?type=designs#name=Engineering_Design_Manual\nThe standards include the Engineering Design Manual plus Engineering General Notes, Norwich Fire Regulations, Policies, Small Cell Design Guidelines, Standard Drawings, and Street Naming & Addressing Standards.\nEngineering Design Manual chapters: 1) Project Types & Plan Requirements; 2) Development Procedures & Submittal Requirements; 3) Construction & Material Specifications; 4) Roadway; 5) Sanitary Sewers; 6) Water Lines; 7) Stormwater; 8) Soil Erosion & Sedimentation Control; 9) Traffic Control Devices; 10) Lighting; 11) Green Infrastructure Improvements; 12) Landscape & Tree Standards.\nUse this for questions about engineering/design/construction standards — roadway & pavement design, sanitary sewer or water main design, stormwater management/detention, erosion & sediment control, traffic control devices, street lighting, green infrastructure, landscaping/tree requirements, development plan submittal requirements, standard construction drawings, and street naming/addressing. These are technical standards for design professionals; link the manual, name the relevant chapter, and refer detailed or project-specific questions to the Engineering Division (Development Services), hilliardohio.gov/engineering-division/ or (614) 876-7361.";

const DEFAULT_TOPICS = [
 {
  "id": "t1",
  "name": "Emergencies",
  "keywords": "emergency, house fire, ambulance, heart attack, overdose, break-in, burglary in progress, someone is hurt",
  "mode": "fixed",
  "body": "If this is an emergency, please call 911 right away.\n\nFor police non-emergencies, call the Hilliard Division of Police at (614) 876-7321 (answered 24/7). Fire and EMS in Hilliard are provided by Norwich Township Fire: (614) 876-7694.",
  "enabled": true
 },
 {
  "id": "t2",
  "name": "Legal advice guardrail",
  "keywords": "sue, lawsuit, lawyer, attorney, evict, eviction, custody, court case",
  "mode": "guide",
  "body": "The resident may be asking for legal advice. Provide factual information about city code or processes only, clearly state that the City cannot provide legal advice, and suggest consulting a licensed attorney. For Mayor's Court matters, share the Clerk of Court number (614) 334-2348.",
  "enabled": true
 },
 {
  "id": "t3",
  "name": "Prices and fees",
  "keywords": "cost, fee, price, how much, rate for",
  "mode": "guide",
  "body": "If the question involves current prices or fees (pool passes, memberships, permit fees, program costs), do not quote specific dollar amounts from memory. Direct the resident to the official page or phone number where current pricing is posted.",
  "enabled": true
 }
];

/* ---------------- tools ---------------- */
const TOOLS = [{
  name: 'lookup_zoning',
  description: "Look up the official zoning district AND property details for a Hilliard, Ohio location via the City's GIS and Franklin County Auditor parcel data. The location can be a street address OR a place/business/landmark name (e.g. 'Hilliard Kroger on Cemetery Rd', 'The Well', 'Hilliard City Hall') — the system geocodes names to their address automatically. Use whenever the resident asks about a SPECIFIC address, property, business, or landmark: its zoning, allowed uses, building rules, lot size/acreage, owner, year built, last sale, property class, or subdivision. Returns the matched parcel, zoning district (for PUDs: the name and a link to the governing development text), county property details, a zoning_map (static image + links to the live City zoning map), and an auditor_link to the parcel's page on the Franklin County Auditor site. If the address isn't in the City's parcel layer, the tool automatically searches Franklin County Auditor records county-wide (found_via tells you which source matched). If the input was a place name, the result includes resolved_place — mention the resolved street address so the resident can confirm it's the right property. Never guess a property's zoning or details — always use this tool.",
  input_schema: { type: 'object', properties: { address: { type: 'string', description: "A Hilliard street address (e.g. '3800 Municipal Way') OR a place/business/landmark name (e.g. 'Hilliard Kroger on Cemetery Rd'). Pass the resident's description as-is." } }, required: ['address'] }
}, {
  name: 'lookup_permits',
  description: "Retrieve the actual list of permits and records issued for a specific Hilliard property from the City's OpenGov Permitting & Licensing system. Use this ONLY when producing a zoning letter/summary, or when the resident explicitly wants the permit list for a specific address — and ONLY after you already have the confirmed matched address from a prior lookup_zoning call. Returns permit records (number, type, status, date), or an 'unavailable' flag when live lookup can't run (in which case fall back to the OpenGov portal search link).",
  input_schema: { type: 'object', properties: { address: { type: 'string', description: "The confirmed property address, e.g. '3800 Municipal Way'" } }, required: ['address'] }
}, {
  name: 'search_projects',
  description: "Search the City of Hilliard Planning & Zoning application master list — every Planning & Zoning Commission, Board of Zoning Appeals, rezoning, PUD, plat, lot split, conditional-use, variance, and site-plan application on record — by keyword. Use when the resident asks about a named project or development (e.g. 'Hoffman Farms', 'Heritage Golf Club', 'Soma'), wants a list of applications of a given type (e.g. 'list the PUDs in Hilliard', 'conditional-use applications', 'rezonings on Cemetery Rd'), or uses a project/case keyword that is not a street address. Pass concise keywords (drop filler words). Returns matching applications with project name, application type, zoning, location, case/record number, and P&Z/Council approval dates.",
  input_schema: { type: 'object', properties: { query: { type: 'string', description: "Keyword(s) to search, e.g. 'Hoffman Farms', 'PUD', 'conditional use', 'Cemetery Rd rezoning'" } }, required: ['query'] }
}];

/* ---------------- live city news (hilliardohio.gov/feed, cached 6h in KV) ---------------- */
function stripHtml(s) {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ')
    .replace(/&#8217;|&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8211;|&#8212;/g, '-').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}
async function getNews(env) {
  let cached = null;
  try { const c = await env.KV.get('news:cache'); if (c) cached = JSON.parse(c); } catch (e) {}
  if (cached && Date.now() - cached.ts < 6 * 3600 * 1000) return cached.text;
  try {
    const r = await fetch('https://hilliardohio.gov/feed/', {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HilliardAssistant/1.0; +https://hilliardohio.gov)', 'accept': 'application/rss+xml, application/xml, text/xml' }
    });
    if (!r.ok) throw new Error('feed status ' + r.status);
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(m => {
      const g = (tag) => { const mm = m[1].match(new RegExp('<' + tag + '>([\\s\\S]*?)<\\/' + tag + '>')); return mm ? stripHtml(mm[1]) : ''; };
      const body = (m[1].match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || ['', ''])[1];
      const text = stripHtml(body || '').slice(0, 1100);
      return '• ' + g('title') + ' (' + g('pubDate').slice(0, 16) + ') — ' + (text || g('description').slice(0, 400)) + ' [Full story: ' + g('link') + ']';
    });
    if (!items.length) throw new Error('no items parsed');
    const text = items.join('\n');
    await env.KV.put('news:cache', JSON.stringify({ ts: Date.now(), text }), { expirationTtl: 7 * 86400 });
    return text;
  } catch (e) {
    console.log('news fetch failed', e.message);
    return cached ? cached.text : '';
  }
}

/* ---------------- Legislation drafting (STAFF ONLY) ----------------
   Gated on the STAFF_PASSWORD secret, checked in the Worker on every request. The
   staff-mode checkbox in the page is only a display convenience — it is set in the
   visitor's own browser and proves nothing, so it must never be what unlocks this.

   The Worker cannot browse CivicWeb (its Document Center is JavaScript-rendered) or
   parse PDFs, so the model library is pre-built: legislation-index.json carries the
   full text of a few model documents plus a catalogue of adopted legislation. Rebuild
   and republish that file to add more models. */
const LEGISLATION_DEFAULT_URL = 'https://hilliardohio.github.io/chat/legislation-index.json';
async function getLegislation(env) {
  try {
    const cached = await env.KV.get('legis:cache');
    if (cached) {
      const o = JSON.parse(cached);
      if (Date.now() - o.ts < 6 * 3600 * 1000) return o.data;
    }
  } catch (e) {}
  const url = (await env.KV.get('config:legislationUrl')) || LEGISLATION_DEFAULT_URL;
  // Cache successes only. A plain cacheTtl would also cache a 404 — which happens
  // naturally in the minute between committing the file and GitHub Pages republishing
  // it — and that 404 would then persist long after the file went live.
  const r = await fetch(url, { cf: { cacheTtlByStatus: { '200-299': 3600, '300-399': 0, '400-499': 0, '500-599': 0 } } });
  if (!r.ok) throw new Error('legislation index fetch failed (' + r.status + ') — if the file was just committed, GitHub Pages may still be republishing; try again in a minute');
  const data = await r.json();
  try { await env.KV.put('legis:cache', JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
  return data;
}
// Score catalogue entries and models against the request so the draft is built from a
// genuinely comparable document rather than whichever one happens to be first.
const LEGIS_STOP = new Set(['the','a','an','and','or','for','of','to','in','on','at','is','are','be','draft','new','resolution','ordinance','staff','report','city','hilliard','please','need','council']);
function legisTerms(q) {
  return [...new Set(String(q || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !LEGIS_STOP.has(w)))];
}
function scoreLegis(text, terms) {
  const t = String(text || '').toLowerCase();
  let s = 0;
  for (const w of terms) if (t.includes(w)) s++;
  return s;
}
async function findLegislationModels(env, query) {
  try {
    const idx = await getLegislation(env);
    const terms = legisTerms(query);
    const models = (idx.models || [])
      .map(m => ({ m, s: scoreLegis(m.title + ' ' + m.kind + ' ' + m.text, terms) }))
      .sort((a, b) => b.s - a.s);
    const related = (idx.documents || [])
      .map(d => ({ d, s: scoreLegis(d.subject, terms) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map(x => ({
        number: x.d.number, type: x.d.type, subject: x.d.subject,
        adopted: x.d.month + ' ' + x.d.year,
        url: (idx.documentUrlPattern || '').replace('{docId}', x.d.docId)
      }));
    return {
      model: models.length && models[0].s > 0 ? models[0].m : (models[0] ? models[0].m : null),
      model_was_close_match: !!(models.length && models[0].s > 0),
      other_models: models.slice(1, 3).map(x => ({ number: x.m.number, title: x.m.title, kind: x.m.kind })),
      related_adopted_legislation: related,
      index_generated: idx.generated,
      catalogue_size: (idx.documents || []).length
    };
  } catch (e) {
    return { unavailable: true, reason: (e && e.message) || 'error' };
  }
}
/* Appended to the system prompt only for verified staff. Mirrors the Cowork
   ordinance-prep skill: model-first, flag rather than invent, nothing that implies
   review or adoption that hasn't happened. */
const STAFF_DRAFTING_PROMPT = `== STAFF MODE: LEGISLATION DRAFTING (verified City staff only) ==
You are talking to a verified City of Hilliard staff member. In addition to everything above, you can draft Council legislation.

- WHEN TO DRAFT: if they ask you to draft, prepare or write an ordinance, resolution, staff report, Council packet item or agenda item — or describe a Council-approvable action (property transfer, easement, right-of-way vacation, acceptance of public infrastructure, zoning amendment, agreement, fee change, appropriation, contract award).
- ALWAYS call draft_legislation FIRST with a short description of what's needed. It returns a model document's full text plus related adopted legislation. Never draft from memory — the result would use conventions the City does not have.
- CHECK FOR DUPLICATES: look at related_adopted_legislation in the result. If something there already appears to cover this exact action, say so plainly, name it with its number and date, and ask what they actually need before drafting. Drafting a duplicate wastes staff time and creates a confusing record.
- CONFIRM THE MODEL: name the model you're using in one line ("modeling from Resolution 26-R-74, the Alton Place sanitary sewer acceptance"). If model_was_close_match is false, say the library has no close match, name what you're falling back to, and ask whether to continue.
- FOLLOW THE MODEL exactly — caption style, WHEREAS phrasing and order, section numbering, enacting language, signature and clerk-certificate blocks. Substitute the new facts.
- FLAG, NEVER INVENT. Any fact you were not given goes inline in square brackets naming just the missing thing — [developer name], [project number], [parcel number], [not-to-exceed amount], [date of P&Z recommendation] — placed exactly where the fact belongs. Keep them short and descriptive so the reader can fill them in without hunting for context. Do NOT write "NEEDS CONFIRMATION" or any similar label; the brackets are the signal. This applies to project numbers, parcel numbers, legal descriptions, dollar figures, dates, developer names and the legislation number itself (the Clerk assigns it). A draft with five bracketed blanks is useful; one with five invented parcel numbers is worse than useless because the errors are invisible.
- WHAT TO LEAVE OUT of the legislation, even though the model documents contain them:
  * the header line that begins "Resolution:" or "Ordinance:" with the number, Adopted and Effective — omit it entirely and open with the all-caps caption
  * the entire execution block at the end — everything from "ATTEST:" through the Certificate of the Clerk and "IN TESTIMONY WHEREOF". Stop after the final numbered SECTION. The Clerk adds these.
  Never write "Approved as to form" as though it happened.
- OUTPUT FORMAT: put the legislation between the exact markers <<<DRAFT LEGISLATION>>> and <<<END DRAFT LEGISLATION>>>, and the staff report between <<<STAFF REPORT>>> and <<<END STAFF REPORT>>>. The page turns each into a downloadable Word file. Plain text inside the markers — no markdown, no asterisks, no # headers. Separate every paragraph, WHEREAS clause and SECTION with a blank line; the Word converter uses blank lines to find paragraph breaks, so text run together will come out as one block.
- STAFF REPORT: no memo header — omit TO, FROM, DATE and RE entirely and open directly with the first substantive heading (Background). Follow the model's remaining headings and order: background, analysis, fiscal impact, recommendation. Put each heading on its own line with a blank line before and after it.
- End the staff report with a short "Drafting notes — delete before filing" section naming the model document used and listing every bracketed blank, so provenance travels with the file once it is emailed around.
- After the markers, add one or two sentences on what you modeled from and what still needs confirming. Don't recap the draft.
- These are unreviewed working drafts that go to the Law Director before Council. Say so if it's the first draft in the conversation.`;
const DRAFT_TOOL = {
  name: 'draft_legislation',
  description: 'Staff only. Look up a model ordinance or resolution from the City\'s adopted legislation library, plus related adopted items, so a new draft can be modeled on real City drafting conventions. Call this FIRST, before writing any draft. Pass a short description of the legislation needed.',
  input_schema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'What the legislation must do, e.g. "resolution accepting public infrastructure for Alton Place Section 2 sanitary sewer"' }
    },
    required: ['subject']
  }
};

/* ---------------- OpenGov Permitting & Licensing permit history (server-side) ----------------
   Runs only in the Worker so the OPENGOV_API_KEY secret never reaches the browser.
   Base + auth verified against the live API:
     GET https://api.plce.opengov.com/plce/v2/hilliardoh/locations   (find location by address)
     GET https://api.plce.opengov.com/plce/v2/hilliardoh/records     (records for a location)
     Header: Authorization: Token <key>   Accept: application/vnd.api+json
   Always degrades gracefully: any missing key / auth failure / error returns
   { unavailable: true }, and the letter falls back to the portal search link. */
const PLCE_BASE = 'https://api.plce.opengov.com/plce/v2/hilliardoh';
// Hilliard record-number prefixes -> friendly type names (fallback when the API
// doesn't return a resolvable record-type name).
const PREFIX_TYPES = {
  PZ: 'Planning & Zoning Commission Application', BZA: 'Board of Zoning Appeals Application',
  S: 'Sign Permit', KHD: 'Commercial Kitchen Hood Permit', GAS: 'Gas Line Permit',
  FS: 'Fire Protection System Permit', FA: 'Fire Alarm System Permit', PLAT: 'Address Request',
  HVAC: 'HVAC/Refrigeration Permit', MECH: 'Mechanical Permit', WCSC: 'Water & Sewer Taps',
  PLMB: 'Plumbing Permit', ELEC: 'Electrical Permit', CIV: 'Civil/Site Plan Review',
  FP: 'Special Flood Hazard Area Development Permit', PLR: 'Commercial Plan Review',
  CBLD: 'Building Permit - Commercial', RBLD: 'Building Permit - Residential',
  DEMO: 'Demolition Permit', DRV: 'Driveway Permit', ROW: 'Right-of-Way Permit',
  POOL: 'Pool/Spa Permit', ZC: 'Zoning Certificate', ZVL: 'Zoning Verification Letter',
  CE: 'Code Enforcement', CV: 'Code Violation'
};
const STREET_SUFFIX = ['RD', 'ROAD', 'DR', 'DRIVE', 'ST', 'STREET', 'AVE', 'AVENUE', 'AV', 'LN', 'LANE', 'CT', 'COURT', 'BLVD', 'BOULEVARD', 'WAY', 'WY', 'CIR', 'CIRCLE', 'PL', 'PLACE', 'PKWY', 'PARKWAY', 'SQ', 'SQUARE', 'TRL', 'TRAIL', 'LOOP', 'RUN', 'XING', 'CROSSING', 'TER', 'TERRACE'];
function parseAddress(address) {
  const norm = String(address || '').toUpperCase().replace(/[.,#]/g, ' ')
    .replace(/\b(HILLIARD|COLUMBUS|OHIO|OH|USA)\b.*$/, '').replace(/\b\d{5}(-\d{4})?\b/g, '')
    .replace(/\s+/g, ' ').trim();
  const m = norm.match(/^(\d+)\s+(.+)$/);
  const streetNo = m ? m[1] : '';
  const rest = (m ? m[2] : norm).split(' ');
  const streetNameFull = rest.join(' ').trim();                       // e.g. "MUNICIPAL WAY"
  const streetName = rest.filter(w => !STREET_SUFFIX.includes(w)).join(' ').trim(); // "MUNICIPAL"
  return { streetNo, streetName, streetNameFull };
}
// street name casing/format is uncertain, so try several variants
function streetNameVariants(s) {
  const up = s.toUpperCase();
  const lo = s.toLowerCase();
  const title = lo.replace(/\b\w/g, c => c.toUpperCase());
  return [...new Set([up, title, lo, s])].filter(Boolean);
}
// OpenGov stores street NUMBER and NAME as separate fields; find a location by
// combining filter[streetNumber] + filter[streetName]. Try the name with and
// without its suffix, across casings, and stop at the first request that returns
// a match.
// Street-type suffixes come in abbreviated and spelled-out forms, and the GIS
// geocoder and OpenGov don't always agree (e.g. GIS "MUNICIPAL WY" vs OpenGov
// "MUNICIPAL WAY"). Generate every equivalent full street-name form to try.
const SUFFIX_EQUIV = [
  ['WAY', 'WY'], ['ROAD', 'RD'], ['DRIVE', 'DR'], ['STREET', 'ST'], ['AVENUE', 'AVE', 'AV'],
  ['LANE', 'LN'], ['COURT', 'CT'], ['BOULEVARD', 'BLVD'], ['PARKWAY', 'PKWY', 'PKY'],
  ['CIRCLE', 'CIR'], ['PLACE', 'PL'], ['SQUARE', 'SQ'], ['TRAIL', 'TRL'], ['TERRACE', 'TER'],
  ['CROSSING', 'XING'], ['LOOP'], ['RUN'], ['RUN'], ['PIKE'], ['ROW']
];
function nameCandidates(streetName, streetNameFull) {
  const out = new Set();
  for (const f of [streetNameFull, streetName].filter(Boolean)) {
    out.add(f);
    const parts = f.split(' ');
    if (parts.length >= 2) {
      const last = parts[parts.length - 1].toUpperCase();
      const base = parts.slice(0, -1).join(' ');
      for (const grp of SUFFIX_EQUIV) {
        if (grp.includes(last)) for (const alt of grp) out.add(base + ' ' + alt);
      }
    }
  }
  if (streetName) out.add(streetName); // base with no suffix, last resort
  return [...out];
}
async function findLocation(H, streetNo, streetName, streetNameFull) {
  const nameBases = nameCandidates(streetName, streetNameFull);
  for (const base of nameBases) {
    for (const v of streetNameVariants(base)) {
      const params = { 'page[size]': '25', 'filter[streetName]': v };
      if (streetNo) params['filter[streetNumber]'] = streetNo;
      const r = await fetch(PLCE_BASE + '/locations?' + new URLSearchParams(params), { headers: H });
      if (r.status === 401 || r.status === 403) return { auth: true };
      if (r.ok) {
        const data = (await r.json()).data || [];
        if (data.length) {
          const exact = data.find(l => String((l.attributes || {}).streetNo || '').trim() === streetNo);
          return { loc: exact || data[0] };
        }
      }
    }
  }
  return { loc: null };
}
// Is a code-enforcement record type actually visible to this API key? Only if so can the
// letter truthfully say a property has no code enforcement history. Cached for a day.
const CE_TYPE_RE = /code\s*(violation|enforcement)|property\s*maintenance|grass|weed|nuisance/i;
async function ceTypesAccessible(env, H) {
  try { const c = await env.KV.get('ce:accessible'); if (c === '1') return true; if (c === '0') return false; } catch (e) {}
  try {
    let has = false, seen = 0, page = 1, totalPages = 1;
    // Page through the accessible record types — the CE type may not be on the first page.
    while (page <= Math.min(totalPages, 10)) {
      const r = await fetch(PLCE_BASE + '/record-types?' + new URLSearchParams({ 'page[size]': '100', 'page[number]': String(page) }), { headers: H });
      if (!r.ok) return null;
      const j = await r.json();
      const data = j.data || [];
      seen += data.length;
      if (data.some(t => CE_TYPE_RE.test(((t.attributes || {}).name) || ''))) { has = true; break; }
      totalPages = (j.meta && j.meta.totalPages) || 1;
      if (!data.length) break;
      page++;
    }
    if (!seen) return null;
    try { await env.KV.put('ce:accessible', has ? '1' : '0', { expirationTtl: 86400 }); } catch (e) {}
    return has;
  } catch (e) { return null; }
}
function isCodeEnforcement(r) {
  const pfx = String(r.number || '').split('-')[0].toUpperCase();
  return CE_TYPE_RE.test(r.type || '') || pfx === 'CE' || pfx === 'CV';
}
async function lookupPermitsOpenGov(env, address) {
  const key = env.OPENGOV_API_KEY;
  if (!key) return { unavailable: true, reason: 'not_configured' };
  const { streetNo, streetName, streetNameFull } = parseAddress(address);
  if (!streetName) return { unavailable: true, reason: 'unparseable_address' };
  const H = { 'Authorization': 'Token ' + key, 'accept': 'application/vnd.api+json' };
  const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const prefixName = (num) => PREFIX_TYPES[String(num || '').split('-')[0].toUpperCase()] || '';
  try {
    // 1) find the location by combining street number + street name
    const found = await findLocation(H, streetNo, streetName, streetNameFull);
    if (found.auth) return { unavailable: true, reason: 'auth' };
    const loc = found.loc;
    if (!loc) return { records: [], count: 0, note: 'no matching location in the permit system' };
    // Direct link to this property's OpenGov record page (uses the location id).
    const locUrl = 'https://hilliardoh.portal.opengov.com/locations/' + loc.id;
    // OpenGov's owner name is usually more current than the county Auditor parcel data.
    const ownerName = ((loc.attributes || {}).ownerName || '').trim();
    // 2) that location's records (filter[locationID] is the valid record filter)
    const recResp = await fetch(PLCE_BASE + '/records?' + new URLSearchParams({ 'filter[locationID]': loc.id, 'page[size]': '100' }), { headers: H });
    if (recResp.status === 401 || recResp.status === 403) return { unavailable: true, reason: 'auth' };
    if (!recResp.ok) return { unavailable: true, reason: 'records_' + recResp.status };
    const recs = (await recResp.json()).data || [];
    // 3) resolve each record's recordType name by fetching it directly by id
    const typeMap = {};
    const typeIds = [...new Set(recs.map(r => {
      const rel = r.relationships || {};
      return rel.recordType && rel.recordType.data && rel.recordType.data.id;
    }).filter(Boolean))];
    await Promise.all(typeIds.map(async (id) => {
      try {
        const tr = await fetch(PLCE_BASE + '/record-types/' + id, { headers: H });
        if (tr.ok) typeMap[id] = (((await tr.json()).data || {}).attributes || {}).name || '';
      } catch (e) { /* fall back to prefix */ }
    }));
    // 4) shape the records; keep only official (numbered, non-draft) records
    const records = recs.map(r => {
      const a = r.attributes || {};
      const rel = r.relationships || {};
      const typeId = rel.recordType && rel.recordType.data && rel.recordType.data.id;
      return {
        number: a.number || '',
        type: (typeId && typeMap[typeId]) || prefixName(a.number) || a.typeDescription || '',
        status: titleCase(a.status || ''),
        date: String(a.submittedAt || a.createdAt || '').slice(0, 10),
        url: r.id ? ('https://hilliardoh.portal.opengov.com/records/' + r.id) : ''
      };
    })
      .filter(x => x.number && (x.status || '').toUpperCase() !== 'DRAFT')
      // Zoning letters lead with Planning & Zoning Commission (PZ) and Board of
      // Zoning Appeals (BZA) records; newest-first within each group.
      .sort((x, y) => {
        const pr = r => (/^(PZ|BZA)$/.test(String(r.number || '').split('-')[0].toUpperCase())
          || /Planning and Zoning Commission|Board of Zoning Appeals/i.test(r.type || '')) ? 0 : 1;
        const d = pr(x) - pr(y);
        return d !== 0 ? d : (y.date || '').localeCompare(x.date || '');
      });
    // Cap the list shown in the letter so it can't overflow; note the remainder.
    const DISPLAY = 15;
    const shown = records.slice(0, DISPLAY);
    // Code enforcement is assessed across ALL of the property's records (not just the ones
    // listed), and only claimed as "none" when a code-enforcement record type is visible.
    const ceAll = records.filter(isCodeEnforcement);
    const closedRe = /complete|closed|void|withdraw|resolved|abated/i;
    // If CE records were found, visibility is self-evident; only verify when none were found.
    const ceVisible = ceAll.length ? true : await ceTypesAccessible(env, H);
    const code_enforcement = {
      checked: ceVisible === true,
      count: ceAll.length,
      open_count: ceAll.filter(r => !closedRe.test(r.status || '')).length,
      closed_count: ceAll.filter(r => closedRe.test(r.status || '')).length,
      records: ceAll.slice(0, 12)
    };
    return { records: shown, count: shown.length, total: records.length, more: Math.max(0, records.length - shown.length), code_enforcement, location_id: loc.id, location_url: locUrl, owner_name: ownerName || undefined, source: 'OpenGov Permitting & Licensing' };
  } catch (e) {
    return { unavailable: true, reason: (e && e.message) || 'error' };
  }
}

/* ---------------- Planning & Zoning application master list (published CSV) ----------------
   The admin sets a public CSV link in /admin (config:projectsCsv). The Worker fetches it
   server-side (no CORS/auth issues), caches the parsed rows in KV for an hour, and the
   search_projects tool / /api/projects endpoint search it by keyword. */
const PROJECTS_DEFAULT_CSV = 'https://hilliardohio.github.io/chat/projects.csv';
function parseCSV(text, delim) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  if (!delim) {
    const nl = s.indexOf('\n');
    const first = nl > -1 ? s.slice(0, nl) : s;
    delim = (first.split('\t').length > first.split(',').length) ? '\t' : ',';
  }
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function projectDateKey(d) {
  const m = String(d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return '';
  const y = m[3].length === 2 ? (+m[3] > 50 ? '19' + m[3] : '20' + m[3]) : m[3];
  return y + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
}
async function getProjects(env) {
  try { const c = await env.KV.get('projects:cache'); if (c) { const o = JSON.parse(c); if (Date.now() - o.ts < 3600 * 1000) return o.rows; } } catch (e) {}
  // Preferred: the spreadsheet pasted into /admin (no publishing or Microsoft login needed).
  let text = await env.KV.get('projects:data');
  if (!text) {
    // Fall back to the published CSV: an admin-set link, else the default alongside the chat page.
    const url = (await env.KV.get('config:projectsCsv')) || PROJECTS_DEFAULT_CSV;
    if (!url) throw new Error('not_loaded');
    const r = await fetch(url, { headers: { 'accept': 'text/csv,text/plain,*/*' }, redirect: 'follow' });
    if (!r.ok) throw new Error('the published link returned ' + r.status);
    text = await r.text();
    if (/^\s*</.test(text)) throw new Error('the link returned a web page, not CSV data (use a direct CSV link, or paste the sheet in /admin)');
  }
  const table = parseCSV(text);
  let hi = table.findIndex(row => row.some(c => /project name|application|case #|opengov/i.test(String(c))));
  if (hi < 0) hi = 0;
  const headers = table[hi].map(h => String(h || '').trim());
  const idx = (re) => headers.findIndex(h => re.test(h));
  const col = {
    record: idx(/opengov/i), caseNo: idx(/^case/i), project: idx(/project/i), location: idx(/^location/i),
    application: idx(/application/i), zoning: idx(/^zoning/i), pz: idx(/p\s*&\s*z|pz\s*approv/i),
    council: idx(/council/i), parcel: idx(/parcel/i), address: idx(/auditor|address/i)
  };
  const g = (row, i) => i >= 0 ? String(row[i] || '').replace(/\s+/g, ' ').trim() : '';
  const rows = table.slice(hi + 1).map(row => ({
    record: g(row, col.record), case: g(row, col.caseNo), project: g(row, col.project), location: g(row, col.location),
    application: g(row, col.application), zoning: g(row, col.zoning), pz_approval: g(row, col.pz),
    council_approval: g(row, col.council), parcel: g(row, col.parcel), address: g(row, col.address)
  })).filter(x => x.project || x.application || x.record || x.case);
  if (!rows.length) throw new Error('no application rows found — check that the pasted/exported data includes the header row');
  try { await env.KV.put('projects:cache', JSON.stringify({ ts: Date.now(), rows }), { expirationTtl: 7 * 86400 }); } catch (e) {}
  return rows;
}
const PROJECT_STOP = new Set(['a','an','the','of','in','on','at','for','to','and','or','list','lists','all','any','show','give','me','find','what','which','are','is','was','were','there','hilliard','city','ohio','oh','please','about','applications','application','projects','project','records','record']);
function singular(t) { return t.length > 3 && /s$/.test(t) && !/ss$/.test(t) ? t.slice(0, -1) : t; }
// Resolve OpenGov record numbers (e.g. "PZ-26-14") to their portal record ids so results can
// link straight to the record page. Caches each number->id in KV, and remembers which filter
// field the API accepts. Fails silently — results simply show the number without a link.
async function opengovRecordLinks(env, numbers) {
  const key = env.OPENGOV_API_KEY;
  const list = (numbers || []).filter(Boolean).slice(0, 25);
  if (!key || !list.length) return {};
  const H = { 'Authorization': 'Token ' + key, 'accept': 'application/vnd.api+json' };
  const out = {};
  let working = null;
  try { working = await env.KV.get('ogrec:filterKey'); } catch (e) {}
  const candidates = working ? [working] : ['filter[number]', 'filter[recordNumber]', 'filter[humanReadableId]'];
  await Promise.all(list.map(async (num) => {
    try { const c = await env.KV.get('ogrec:' + num); if (c) { if (c !== '0') out[num] = c; return; } } catch (e) {}
    for (const k of candidates) {
      try {
        const r = await fetch(PLCE_BASE + '/records?' + new URLSearchParams({ [k]: num, 'page[size]': '1' }), { headers: H });
        if (!r.ok) continue;
        const d = ((await r.json()).data) || [];
        if (d.length && d[0].id) {
          out[num] = d[0].id;
          if (!working) { working = k; try { await env.KV.put('ogrec:filterKey', k); } catch (e) {} }
          try { await env.KV.put('ogrec:' + num, String(d[0].id), { expirationTtl: 30 * 86400 }); } catch (e) {}
          return;
        }
      } catch (e) { /* try next */ }
    }
    try { await env.KV.put('ogrec:' + num, '0', { expirationTtl: 7 * 86400 }); } catch (e) {}
  }));
  return out;
}
async function searchProjects(env, query) {
  try {
    const rows = await getProjects(env);
    const terms = [...new Set(String(query || '').toLowerCase().split(/[^a-z0-9&\-]+/).map(t => t.trim()).filter(t => t.length > 1 && !PROJECT_STOP.has(t)).map(singular))];
    if (!terms.length) return { error: 'Provide a keyword such as a project name, application type (e.g. PUD, rezoning, conditional use), zoning district, street, or case number.' };
    const scored = [];
    for (const x of rows) {
      const proj = x.project.toLowerCase(), app = x.application.toLowerCase(), zon = x.zoning.toLowerCase();
      const hay = [proj, app, zon, x.location, x.case, x.record, x.address].join(' | ').toLowerCase();
      let sc = 0;
      for (const t of terms) {
        if (proj.includes(t)) sc += 4;
        else if (app.includes(t) || zon.includes(t)) sc += 3;
        else if (hay.includes(t)) sc += 1;
      }
      if (sc > 0) scored.push({ x, sc });
    }
    scored.sort((a, b) => (b.sc - a.sc) || projectDateKey(b.x.pz_approval).localeCompare(projectDateKey(a.x.pz_approval)));
    const total = scored.length, LIMIT = 25;
    const results = scored.slice(0, LIMIT).map(o => Object.assign({}, o.x));
    // Attach direct OpenGov record links where the record number resolves.
    try {
      const links = await opengovRecordLinks(env, [...new Set(results.map(r => r.record).filter(Boolean))]);
      for (const r of results) { const id = links[r.record]; if (id) r.url = 'https://hilliardoh.portal.opengov.com/records/' + id; }
    } catch (e) { /* links are optional */ }
    return {
      query, matched_terms: terms, total_matches: total, shown: results.length, results,
      note: total > LIMIT ? ('Showing the top ' + LIMIT + ' of ' + total + ' matches, most relevant/recent first. Ask the resident to narrow the search (e.g. add a street or year) for the rest.') : undefined,
      source: 'City of Hilliard Planning & Zoning application master list (maintained by the Planning Division)',
      official_record_note: 'For the official record of any application, see the OpenGov permit portal (hilliardoh.portal.opengov.com) or contact the Planning Division, (614) 334-2366.'
    };
  } catch (e) {
    return { unavailable: true, reason: (e && e.message) || 'error', note: 'The Planning & Zoning application list has not been loaded yet (an administrator can paste the spreadsheet into the /admin page). Refer the resident to the Planning Division at (614) 334-2366 or the OpenGov portal.' };
  }
}
async function callAnthropic(apiKey, model, system, messages, tools, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens || MAX_TOKENS, system, tools: tools || TOOLS, messages })
  });
  return { ok: resp.ok, status: resp.status, data: await resp.json() };
}

function buildSystemPrompt(kb, guides, news) {
  let custom = '';
  if (guides && guides.length) {
    custom = '\n\n== PRIORITY INSTRUCTIONS FROM CITY STAFF (follow these over anything else) ==\n' +
      guides.map(g => '• ' + g).join('\n');
  }
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  return `You are the Hilliard Assistant, a friendly information agent for the City of Hilliard, Ohio, answering residents' questions on the city's website.

RULES:
- Answer ONLY from the knowledge base below. If the answer isn't in it, say you're not certain and direct the resident to the right city contact (phone/email/URL from the knowledge base) — never invent facts, phone numbers, prices, or code sections.
- Keep answers short and practical: 2-6 sentences for most questions. Lead with the direct answer, then the key detail or contact.
- When a city code rule applies, cite the section number (e.g., "§351.14").
- Include the relevant URL or phone number when it helps the resident act.
- SPECIFIC LINKS (IMPORTANT): Always give the single most specific URL rather than the generic hilliardohio.gov homepage or a bare portal link. When a resident asks about a city service, program, or rule, link its exact page from the "SPECIFIC CITY WEBSITE PAGES" section. When a resident asks how or where to apply for a permit or license, or asks about a specific permit type (fence, deck, sign, electrical, HVAC, driveway, etc.), give its exact application URL from the "PERMIT & LICENSE APPLICATION LINKS" section, and remind them an application is not a permit. Copy these URLs exactly as written — never invent or guess a page slug, category id, or record-type id. If no specific link fits, use the most relevant department page or the portal home.
- ENGINEERING STANDARDS: For questions about engineering, design, or construction standards — roadway/pavement design, sanitary sewer or water main design, stormwater management/detention, erosion & sediment control, traffic control devices, street lighting, green infrastructure, landscaping/tree standards, development plan submittal requirements, standard construction drawings, or street naming/addressing — use the ENGINEERING DESIGN & CONSTRUCTION STANDARDS section of the knowledge base: briefly summarize what the standards say or which chapter applies, link to the manual, and refer detailed or project-specific questions to the Engineering Division. Note these are technical standards intended for engineers, developers, and contractors.
- PLANNING & ZONING PROJECTS: when a resident asks about a named project or development, wants a list of applications of a given type (e.g. "list the PUDs in Hilliard", "what conditional-use applications were approved", "rezonings on Cemetery Rd"), or uses a project/case keyword that is not a street address, use the search_projects tool with concise keywords. Present results as a clean list: project name — application type — zoning — location — approval date, followed by the record/case number. IMPORTANT: when a result has a "url", render its record number as a Markdown link using exactly this syntax, including the literal square brackets and parentheses: "[PZ-26-14](THE_URL)" — replacing the label with the result's "record" value and THE_URL with its "url" value copied verbatim. If a result has no "url", write its record number (or case number) as plain text with no link. Never invent a URL for a record. If the result notes more matches than shown, say so and offer to narrow the search. Cite the source as the City's Planning & Zoning application master list and note the official record is on the OpenGov portal / Planning Division. For a specific ADDRESS, still use lookup_zoning; you may use both when a resident asks about a property AND its planning history.
- ADDRESS NOT IN CITY LAYER: if a lookup_zoning result's found_via says the address was found in Franklin County Auditor records (not the City parcel layer), tell the resident the address was located in Franklin County Auditor records, state the matched address, give the auditor_link (their parcel page on the Auditor site), and — if tax_district is not CITY OF HILLIARD — explain the property is outside Hilliard's zoning jurisdiction. Always include the auditor_link when a resident asks about property records or when a property isn't in the City layer.
- ADDRESS NOT FOUND (CRITICAL): if lookup_zoning returns an error with address_not_found, the address does not exist in City or County records. Say so plainly, repeat the address you were given, and — if street_on_file is present — tell the resident the street exists but its addresses run from street_on_file.low to street_on_file.high, so the house number should be re-checked. NEVER produce a zoning letter, a zoning classification, a parcel ID, an owner, a map, or a permit list for a different property, and never call lookup_permits. Do not silently correct the address to a nearby or similar one. Ask the resident to confirm the correct address instead.
- ZONING CLASSIFICATION SOURCE: the district code, its full name, and the code_url come from the lookup_zoning result. Never state, imply, or guess which ordinance created or rezoned a property's district — that information is not returned by any tool. If a resident asks about the rezoning history of a property, tell them the Planning Division ((614) 876-7361, Planning1@hilliardohio.gov) has the rezoning record, and offer to search the Planning & Zoning application master list with search_projects.
- You provide general information, not legal advice. For legal interpretation, suggest the resident contact the relevant department or an attorney.
- If asked about emergencies, always say to call 911 first.
- ZONING BY ADDRESS OR PLACE NAME: when the question concerns a specific address, property, business, or landmark (its zoning, what can be built or operated there), ALWAYS use the lookup_zoning tool first — never guess. You may pass a business/landmark name (e.g. "Hilliard Kroger on Cemetery Rd") directly; the tool resolves it to an address. If the result includes a resolved_place, begin your answer by stating the resolved street address (e.g. "The Hilliard Kroger is at 4656 Cemetery Rd —") so the resident can confirm it's the right property. If lookup_zoning returns an error (place not found), tell the resident it couldn't be located and ask for a street address. Then answer using that district's standards from the knowledge base. If the result is a PUD, explain that the PUD's own approved development text governs (share the pud_text_url link if provided) and refer detailed questions to the Planning Division. If tax_district is not "CITY OF HILLIARD", say the property appears to be outside city zoning jurisdiction. Mention the matched address so the resident can confirm it's the right parcel, and note that GIS results are informational — the Planning Division ((614) 876-7361, Planning1@hilliardohio.gov) provides official zoning verification letters.
- PROPERTY DETAILS: the lookup_zoning tool also returns Franklin County Auditor data for the parcel (owner, acreage, year built, last transfer date/price, property class, subdivision). Use it for questions about lot size, ownership, or property history, and mention the data comes from Franklin County Auditor records. For complete records (values, taxes, photos, transfer history) direct the resident to the Auditor's property search: property.franklincountyauditor.com. Property TAX amounts: Franklin County Auditor/Treasurer, not the City.
- PERMIT HISTORY: to list the permits for a specific address, use the lookup_permits tool (only after you have the confirmed address from lookup_zoning). If it returns records, present them. Whenever the result includes a "location_url", link the resident directly to it (it is that property's OpenGov record page showing every permit) rather than the generic search page. Only if there is no location_url (e.g. the result is "unavailable") fall back to hilliardoh.portal.opengov.com/search — typing the address under "Locations" lists every active and historical permit and its status. Applying for permits, checking their own applications, and requesting zoning verification letters all happen at hilliardoh.portal.opengov.com.
- ZONING LETTER: when a resident asks for a "zoning letter", "zoning verification letter", "ZVL", or a letter documenting their property's zoning: first, if no address was given, ask for the property address. Once you have it, call lookup_zoning; then call lookup_permits with the matched_address to retrieve the property's permit history. Then (a) explain in one or two sentences that OFFICIAL Zoning Verification Letters — which include conformance determinations, variance history, and violation checks researched by Planning staff — are issued by the Planning Division and may be requested at https://hilliardoh.portal.opengov.com/categories/1080/record-types/6376 (a fee applies) — write that full URL verbatim, not the generic portal address — and that you can provide an instant informational summary; then (b) output the summary between the EXACT markers <<<LETTER>>> and <<<END LETTER>>> (the page renders it as a printable letter). Use this structure in plain text, omitting any line with no data:

Date: [today's date]

Requested Property Address: [matched_address], Hilliard, OH
Parcel ID Number: [parcel_id]
Tax District: [tax_district]
School District: [school_district]

To whom it may concern:

In response to a request for information regarding the above referenced property, the following has been compiled from City of Hilliard GIS records and Franklin County Auditor public records:

Zoning Classification: [Write the zone's "district" code, then a space-dash-space, then its "district_name" value — and render that whole "CODE — Name" string as ONE Markdown link to the zone's "code_url", using EXACTLY this syntax with the literal square brackets and parentheses: "[I-FE — I-270 Corridor District, I-FE Flex Employment subdistrict (§1116.08)](PUT_CODE_URL_HERE)". The characters [ ] ( ) are REQUIRED and must appear literally. Copy code_url verbatim. If the zone has no code_url or no district_name, write what you do have as plain text with no link. This line is the ENTIRE zoning classification section: write NOTHING else about the district — no description of the district, no history, no statement about which ordinance established or rezoned it, and never name a rezoning ordinance number. The tool does not return one and you must not infer one.]
[Include the next line ONLY when the district is PUD and a pud_text_url is present, then nothing further:] Approved development text: [Markdown link, literal brackets and parentheses required, labeled with the pud_title value (or "PUD development text" if there is no pud_title) and pointing at the pud_text_url value copied verbatim, never truncated or wrapped. Do not print that URL anywhere except inside the parentheses. The link label must be the PUD's name — NEVER an ordinance number, and never the phrase "Rezoning Ordinance". No sentence may follow this line.]
[ZONING MAP]
[IMPORTANT: output the line "[ZONING MAP]" EXACTLY as those two words in square brackets on its own line — the page replaces it with the zoning map image, a dot marking the property, and a link to the full Hilliard Zoning Map. Do NOT add any sentence describing the map or repeating the zoning-map URL; the caption under the image already covers it.]
Current Use (Franklin County Auditor classification): [property_class][, subdivision if present]
Owner of Record: [Use the owner from lookup_zoning (property_details_from_county_auditor_data.owner) — it comes from Franklin County's live parcel records and is the authoritative, current owner of record. If that is missing, fall back to the owner_name from lookup_permits (OpenGov). Show just the name.]
Parcel Size: approximately [parcel_size_acres] acres
[If present] Residence Year Built: [year]
[If present] Last Transfer: [date][, price if nonzero]

Permit History: [If lookup_permits returned records, write "The [count] most recent permits and records on file for this property are listed below (source: OpenGov Permitting & Licensing):" (if the result's "more" field is 0, instead write "The following permits and records are on file for this property (source: OpenGov Permitting & Licensing):") then list ONLY the records provided in the result, each on its own line as "  - [number](url) — [type] — [status][ — date]" — that is, render the record's number as a Markdown link to its "url" field (e.g. "[CBLD-23-8](https://hilliardoh.portal.opengov.com/records/114789)"), so the number is clickable; if a record has no "url", write the number plain with no link. Keep them in the EXACT order provided — the list is already ordered with Planning & Zoning Commission and Board of Zoning Appeals records first, then most recent first — do not re-sort. Do NOT invent or add any records, numbers, or URLs beyond those returned. If the result's "more" field is greater than 0, add a line after the list: "…plus [more] additional permit records not listed here (this property has [total] records in total)." Then end with a line linking to this property's OpenGov page: if the result has a "location_url", write "View this property's complete permit record history here: " immediately followed by the result's location_url value copied verbatim (a direct link to the property's OpenGov record page — do NOT use the generic /search page when a location_url is available); if there is no location_url, instead write "Verify the complete, current list at hilliardoh.portal.opengov.com/search under the Locations tab." If lookup_permits returned no records: if it has a "location_url", write "No permit records were found on file for this property. View the property's record page at " immediately followed by the location_url value; otherwise write "No permit records were found on file for this property. Verify at hilliardoh.portal.opengov.com/search under the Locations tab." If lookup_permits was unavailable, write "A complete listing of all active and historical permits for this property is available at hilliardoh.portal.opengov.com/search — enter the address under the Locations tab."]

Code Enforcement: [Always include this line when lookup_permits returned a result. Use the result's "code_enforcement" object, which covers ALL of the property's records (not just those listed above): if its "count" is 0 and "checked" is true, write EXACTLY this sentence and nothing else: "No open or historical code enforcement records exist for this property." If "count" is greater than 0, write "The following code enforcement records are on file for this property:" then list each record in code_enforcement.records on its own line as "  - [number] — [type] — [status][ — date]" (render the number as a Markdown link to its "url" when present), and finish with a sentence stating how many are open/active and how many are closed, using the open_count and closed_count values. If "checked" is false, do NOT state that the property is clear — instead write "Code enforcement records could not be verified automatically for this property; contact the City's Code Enforcement staff at (614) 876-7361 to confirm." If lookup_permits was unavailable, omit this Code Enforcement line entirely.]

Formal zoning determinations are researched and certified by Planning Division staff only through an official Zoning Verification Letter, which may be requested at https://hilliardoh.portal.opengov.com/categories/1080/record-types/6376

This summary was generated automatically by the Hilliard Assistant from public records. It is informational only and is not an official statement or certification of the City of Hilliard. Official verification: Community Development — Planning Division, 3800 Municipal Way, Hilliard, OH 43026, (614) 334-2366, Planning1@hilliardohio.gov.
<<<END LETTER>>>
- CURRENT NEWS: the CURRENT CITY NEWS section below is pulled live from hilliardohio.gov/news and refreshed automatically. Use it for questions about recent events, announcements, storms, projects, openings, and "what's happening" — and share the full-story link. If a news question isn't covered there, don't guess; point the resident to hilliardohio.gov/news/ and the weekly newsletter.
- Write in plain text only — no markdown formatting, no asterisks for bold, no # headers. Simple dashes for lists are fine.
- Politely decline questions unrelated to City of Hilliard services, rules, or community life, and steer back to city topics.
- Today's context: it is ${today}.${custom}${news ? '\n\n== CURRENT CITY NEWS (live from hilliardohio.gov/news) ==\n' + news : ''}

== KNOWLEDGE BASE ==
${kb}`;
}

/* ---------------- helpers ---------------- */
function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400'
  };
}
function json(data, status, env) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'content-type': 'application/json', ...corsHeaders(env) } });
}
function safeEq(a, b) {
  const enc = new TextEncoder();
  const ab = enc.encode(String(a || '')), bb = enc.encode(String(b || ''));
  if (ab.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < ab.length; i++) out |= ab[i] ^ bb[i];
  return out === 0;
}
async function getConfig(env) {
  const [kb, topics, model] = await Promise.all([
    env.KV.get('config:kb'),
    env.KV.get('config:topics'),
    env.KV.get('config:model')
  ]);
  return {
    kb: kb || DEFAULT_KB,
    topics: topics ? JSON.parse(topics) : DEFAULT_TOPICS,
    model: model || DEFAULT_MODEL
  };
}

/* in-memory per-IP limiter (best effort, per isolate) */
const ipHits = new Map();
function ipLimited(ip, limit) {
  const hour = Math.floor(Date.now() / 3600000);
  const k = ip + ':' + hour;
  const n = (ipHits.get(k) || 0) + 1;
  ipHits.set(k, n);
  if (ipHits.size > 5000) ipHits.clear();
  return n > limit;
}

/* ---------------- main ---------------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });

    try {
      if (path === '/api/config' && request.method === 'GET') {
        const cfg = await getConfig(env);
        return json({ topics: cfg.topics }, 200, env);
      }

      // Resolve a place/business/landmark name (or fuzzy address) to a Hilliard-area
      // point (+ street address when available) so the browser GIS lookup can find the
      // parcel. Tries the ArcGIS World geocoder first (best for business/landmark names),
      // then OpenStreetMap Nominatim. Bounded to the Hilliard area; cached in KV.
      if (path === '/api/geocode' && request.method === 'GET') {
        const raw = (url.searchParams.get('q') || '').trim().slice(0, 160);
        if (!raw) return json({ error: 'missing_q' }, 400, env);
        const ck = 'geo:' + raw.toLowerCase().replace(/\s+/g, ' ');
        try { const c = await env.KV.get(ck); if (c) return json(JSON.parse(c), 200, env); } catch (e) {}
        const inArea = (lat, lon) => lat > 39.8 && lat < 40.25 && lon > -83.4 && lon < -82.75;
        const cleaned = raw.replace(/\b(on|at|near|the|store|located|location)\b/gi, ' ').replace(/\s+/g, ' ').trim();
        const qCtx = /\b(hilliard|ohio|oh|43026)\b/i.test(cleaned) ? cleaned : (cleaned + ', Hilliard, OH');
        let out = null;
        // 1) ArcGIS World geocoder (keyless), constrained to the Hilliard area.
        try {
          const p = new URLSearchParams({ SingleLine: qCtx, f: 'json', maxLocations: '3', outFields: 'Match_addr,Addr_type', countryCode: 'USA', searchExtent: '-83.30,39.93,-83.03,40.14' });
          const r = await fetch('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?' + p.toString(), { headers: { 'accept': 'application/json' } });
          if (r.ok) {
            const j = await r.json();
            const cand = (j.candidates || []).filter(c => c.location && inArea(c.location.y, c.location.x)).sort((a, b) => (b.score || 0) - (a.score || 0))[0];
            if (cand) {
              const ma = (cand.attributes && cand.attributes.Match_addr) || cand.address || '';
              out = { query: raw, display_name: ma, streetAddress: /^\d/.test(ma) ? ma.split(',')[0] : '', lat: cand.location.y, lon: cand.location.x, source: 'arcgis' };
            }
          }
        } catch (e) {}
        // 2) Fallback: OpenStreetMap Nominatim.
        if (!out) {
          try {
            const p = new URLSearchParams({ q: qCtx, format: 'json', addressdetails: '1', limit: '1', countrycodes: 'us' });
            p.set('viewbox', '-83.30,40.14,-83.03,39.93');
            const r = await fetch('https://nominatim.openstreetmap.org/search?' + p.toString(), { headers: { 'user-agent': 'HilliardAssistant/1.0 (City of Hilliard resident chat; +https://hilliardohio.gov)', 'accept': 'application/json' } });
            if (r.ok) {
              const g = ((await r.json()) || [])[0];
              if (g && inArea(+g.lat, +g.lon)) {
                const a = g.address || {};
                out = { query: raw, display_name: g.display_name, streetAddress: (a.house_number && a.road) ? (a.house_number + ' ' + a.road) : '', lat: +g.lat, lon: +g.lon, source: 'osm' };
              }
            }
          } catch (e) {}
        }
        if (!out) return json({ error: 'no_match' }, 200, env);
        try { await env.KV.put(ck, JSON.stringify(out), { expirationTtl: 60 * 60 * 24 * 30 }); } catch (e) {}
        return json(out, 200, env);
      }

      // GIS proxy: some visitor networks (corporate DNS/TLS filters, VPNs, privacy extensions)
      // block direct browser calls to the GIS servers, which broke zoning lookups for those
      // users. The page falls back to this endpoint, which fetches server-side. Strictly
      // limited to the public City/County ArcGIS hosts — it is not an open proxy.
      if (path === '/api/gis' && request.method === 'GET') {
        const target = url.searchParams.get('u') || '';
        let t;
        try { t = new URL(target); } catch (e) { return json({ error: 'bad_url' }, 400, env); }
        const ALLOWED_GIS_HOSTS = ['maps.hilliardohio.gov', 'gis.franklincountyohio.gov'];
        if (t.protocol !== 'https:' || !ALLOWED_GIS_HOSTS.includes(t.hostname) || !/^\/(arcgis|hosting)\/rest\//.test(t.pathname)) {
          return json({ error: 'host_not_allowed' }, 403, env);
        }
        try {
          const r = await fetch(t.toString(), { headers: { 'accept': '*/*' }, redirect: 'follow' });
          const ct = r.headers.get('content-type') || 'application/octet-stream';
          return new Response(r.body, {
            status: r.status,
            headers: { 'content-type': ct, 'cache-control': 'public, max-age=300', ...corsHeaders(env) }
          });
        } catch (e) {
          return json({ error: 'gis_fetch_failed', reason: (e && e.message) || 'error' }, 502, env);
        }
      }

      // Keyword search of the Planning & Zoning application master list (used by the page
      // when the model calls search_projects in the same turn as the browser-side GIS tool).
      if (path === '/api/projects' && request.method === 'GET') {
        return json(await searchProjects(env, url.searchParams.get('q') || ''), 200, env);
      }

      if (path === '/api/chat' && request.method === 'POST') {
        const ip = request.headers.get('cf-connecting-ip') || 'unknown';
        if (ipLimited(ip, parseInt(env.IP_HOURLY_LIMIT || '30'))) {
          return json({ error: { message: 'Too many requests — please wait a bit and try again.' } }, 429, env);
        }
        // global daily cap
        const day = new Date().toISOString().slice(0, 10);
        const countKey = 'count:' + day;
        const count = parseInt(await env.KV.get(countKey) || '0') + 1;
        if (count > parseInt(env.GLOBAL_DAILY_LIMIT || '500')) {
          return json({ error: { message: 'The assistant has reached its daily limit. Please try again tomorrow or call (614) 876-7361.' } }, 429, env);
        }
        await env.KV.put(countKey, String(count), { expirationTtl: 172800 });

        const apiKey = await env.KV.get('config:apikey');
        if (!apiKey) return json({ error: { message: 'The assistant is not configured yet (no API key set in /admin).' } }, 503, env);

        const body = await request.json();
        const messages = Array.isArray(body.messages) ? body.messages.slice(-16) : null;
        if (!messages || !messages.length) return json({ error: { message: 'Bad request' } }, 400, env);
        if (JSON.stringify(messages).length > 60000) return json({ error: { message: 'Conversation too long — please refresh the page.' } }, 400, env);
        const guides = Array.isArray(body.guides) ? body.guides.slice(0, 10).map(g => String(g).slice(0, 2000)) : [];

        // Staff drafting is unlocked ONLY by the shared STAFF_PASSWORD secret, verified
        // here on every request. The page's staff-mode checkbox lives in the visitor's
        // own browser and is not evidence of anything.
        const isStaff = !!(env.STAFF_PASSWORD && body.staffToken && safeEq(String(body.staffToken), env.STAFF_PASSWORD));
        const tools = isStaff ? TOOLS.concat([DRAFT_TOOL]) : TOOLS;
        const maxTokens = isStaff ? 8000 : MAX_TOKENS;

        const cfg = await getConfig(env);
        const news = await getNews(env);
        let system = buildSystemPrompt(cfg.kb, guides, news);
        if (isStaff) system += '\n\n' + STAFF_DRAFTING_PROMPT;
        // Multi-hop loop: the Worker handles lookup_permits itself (it holds the
        // OpenGov key); lookup_zoning is delegated to the browser (keyless GIS),
        // so any response containing a lookup_zoning call is returned as-is.
        let convo = messages;
        let last = null;
        for (let hop = 0; hop < 4; hop++) {
          const r = await callAnthropic(apiKey, cfg.model, system, convo, tools, maxTokens);
          if (!r.ok) {
            // Surface enough of the upstream failure to diagnose it without leaking the key.
            const up = (r.data && r.data.error) || {};
            const detail = String(up.message || '').slice(0, 300);
            console.log('Anthropic error', r.status, up.type || '', detail);
            let friendly = 'The assistant hit a problem answering. Please try again.';
            if (r.status === 401 || r.status === 403) friendly = 'The assistant’s API key was rejected by Anthropic (HTTP ' + r.status + '). An administrator needs to set a valid key in /admin.';
            else if (r.status === 400 && /credit|balance|quota/i.test(detail)) friendly = 'The Anthropic account has no available credit, so the assistant cannot answer right now. An administrator needs to add credit.';
            else if (r.status === 429) friendly = 'The assistant is being rate-limited by Anthropic right now. Please try again in a minute.';
            else if (r.status === 404 && /model/i.test(detail)) friendly = 'The configured model is not available to this API key. An administrator can change the model in /admin.';
            else if (r.status === 529 || r.status === 503) friendly = 'Anthropic’s service is temporarily overloaded. Please try again in a moment.';
            return json({ error: { message: friendly, upstream_status: r.status, upstream_type: up.type || undefined, upstream_detail: detail || undefined } }, 502, env);
          }
          last = r.data;
          if (r.data.stop_reason !== 'tool_use') return json(r.data, 200, env);
          const toolBlocks = r.data.content.filter(b => b.type === 'tool_use');
          // If the model wants the browser-side GIS tool, hand the whole turn back.
          if (toolBlocks.some(b => b.name === 'lookup_zoning')) return json(r.data, 200, env);
          // Otherwise every tool call is server-side (lookup_permits) — run and continue.
          convo = convo.concat([{ role: 'assistant', content: r.data.content }]);
          const results = [];
          for (const b of toolBlocks) {
            let out;
            if (b.name === 'lookup_permits') out = await lookupPermitsOpenGov(env, b.input && b.input.address);
            else if (b.name === 'search_projects') out = await searchProjects(env, b.input && b.input.query);
            // Re-check isStaff here, not just at tool-list assembly: a tool name in the
            // conversation history must never be enough to reach the drafting library.
            else if (b.name === 'draft_legislation') out = isStaff
              ? await findLegislationModels(env, b.input && b.input.subject)
              : { error: 'not authorized' };
            else out = { error: 'unknown tool' };
            results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) });
          }
          convo = convo.concat([{ role: 'user', content: results }]);
        }
        return json(last, 200, env);
      }

      if (path === '/api/log' && request.method === 'POST') {
        const e = await request.json();
        const entry = {
          ts: new Date().toISOString(),
          question: String(e.question || '').slice(0, 2000),
          answer: String(e.answer || '').slice(0, 8000),
          topic: String(e.topic || '').slice(0, 100),
          source: String(e.source || '').slice(0, 50)
        };
        if (!entry.question) return json({ ok: false }, 400, env);
        const key = 'log:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
        await env.KV.put(key, JSON.stringify(entry), { expirationTtl: 60 * 60 * 24 * 180 }); // keep 180 days
        return json({ ok: true }, 200, env);
      }

      /* ---------------- admin ---------------- */
      if (path === '/admin' && request.method === 'GET') {
        return new Response(ADMIN_HTML, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }

      if (path === '/admin/api' && request.method === 'POST') {
        if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD secret is not set on the Worker.' }, 500, env);
        const body = await request.json();
        if (!safeEq(body.password, env.ADMIN_PASSWORD)) {
          return json({ error: 'Wrong password.' }, 401, env);
        }
        const a = body.action;

        if (a === 'status') {
          const cfg = await getConfig(env);
          const hasKey = !!(await env.KV.get('config:apikey'));
          const day = new Date().toISOString().slice(0, 10);
          const todayCount = parseInt(await env.KV.get('count:' + day) || '0');
          const list = await env.KV.list({ prefix: 'log:', limit: 1000 });
          const projectsCsvUrl = (await env.KV.get('config:projectsCsv')) || '';
          const projectsPasted = !!(await env.KV.get('projects:data'));
          let projectsCount = null, projectsCachedAt = null;
          try { const c = await env.KV.get('projects:cache'); if (c) { const o = JSON.parse(c); projectsCount = (o.rows || []).length; projectsCachedAt = o.ts; } } catch (e) {}
          return json({ hasKey, model: cfg.model, kbLength: cfg.kb.length, kbEdited: cfg.kb !== DEFAULT_KB, topics: cfg.topics, todayCount, logCount: list.keys.length, logMore: !list.list_complete, projectsCsvUrl, projectsPasted, projectsDefaultUrl: PROJECTS_DEFAULT_CSV, projectsCount, projectsCachedAt }, 200, env);
        }
        if (a === 'set_projects_csv') {
          const u = String(body.url || '').trim();
          if (u && !/^https:\/\//i.test(u)) return json({ error: 'Enter a full https:// link to a CSV file.' }, 400, env);
          if (u) await env.KV.put('config:projectsCsv', u); else await env.KV.delete('config:projectsCsv');
          await env.KV.delete('projects:cache');
          return json({ ok: true }, 200, env);
        }
        if (a === 'set_projects_data') {
          const t = String(body.data || '').trim();
          if (!t) { await env.KV.delete('projects:data'); await env.KV.delete('projects:cache'); return json({ ok: true, cleared: true }, 200, env); }
          await env.KV.put('projects:data', t);
          await env.KV.delete('projects:cache');
          try { const rows = await getProjects(env); return json({ ok: true, count: rows.length }, 200, env); }
          catch (e) { return json({ error: 'Saved, but could not read it: ' + ((e && e.message) || 'error') }, 400, env); }
        }
        if (a === 'refresh_projects') {
          await env.KV.delete('projects:cache');
          try { const rows = await getProjects(env); return json({ ok: true, count: rows.length }, 200, env); }
          catch (e) { return json({ error: 'Could not load the CSV: ' + ((e && e.message) || 'error') + '. Check that the link is public and returns CSV.' }, 400, env); }
        }
        if (a === 'set_key') {
          const k = String(body.key || '').trim();
          if (!k.startsWith('sk-ant-')) return json({ error: 'That does not look like an Anthropic API key (should start with sk-ant-).' }, 400, env);
          await env.KV.put('config:apikey', k);
          return json({ ok: true }, 200, env);
        }
        if (a === 'test_key') {
          const apiKey = await env.KV.get('config:apikey');
          if (!apiKey) return json({ error: 'No key stored yet.' }, 400, env);
          const cfg = await getConfig(env);
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: cfg.model, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] })
          });
          if (r.ok) return json({ ok: true }, 200, env);
          const d = await r.json();
          return json({ error: (d.error && d.error.message) || ('API error ' + r.status) }, 400, env);
        }
        if (a === 'set_model') {
          await env.KV.put('config:model', String(body.model || DEFAULT_MODEL));
          return json({ ok: true }, 200, env);
        }
        if (a === 'get_kb') {
          const cfg = await getConfig(env);
          return json({ kb: cfg.kb }, 200, env);
        }
        if (a === 'set_kb') {
          await env.KV.put('config:kb', String(body.kb || ''));
          return json({ ok: true }, 200, env);
        }
        if (a === 'reset_kb') {
          await env.KV.delete('config:kb');
          return json({ ok: true }, 200, env);
        }
        if (a === 'set_topics') {
          if (!Array.isArray(body.topics)) return json({ error: 'topics must be an array' }, 400, env);
          await env.KV.put('config:topics', JSON.stringify(body.topics));
          return json({ ok: true }, 200, env);
        }
        if (a === 'get_log') {
          const list = await env.KV.list({ prefix: 'log:', limit: 1000 });
          const entries = [];
          for (const k of list.keys) {
            const v = await env.KV.get(k.name);
            if (v) entries.push(JSON.parse(v));
          }
          entries.sort((x, y) => x.ts < y.ts ? 1 : -1);
          return json({ entries, complete: list.list_complete }, 200, env);
        }
        if (a === 'clear_log') {
          const list = await env.KV.list({ prefix: 'log:', limit: 1000 });
          for (const k of list.keys) await env.KV.delete(k.name);
          return json({ ok: true, deleted: list.keys.length }, 200, env);
        }
        return json({ error: 'Unknown action' }, 400, env);
      }

      if (path === '/') {
        return new Response('Hilliard Assistant backend is running. The chat page is hosted separately; admin at /admin.', { headers: { 'content-type': 'text/plain' } });
      }
      return json({ error: 'Not found' }, 404, env);
    } catch (err) {
      console.log('Worker error', err.stack || err.message);
      return json({ error: { message: 'Server error' } }, 500, env);
    }
  }
};

/* ---------------- admin page ---------------- */
const ADMIN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hilliard Assistant — Admin</title>
<style>
:root{--navy:#1b3a5c;--green:#2e7d4f;--bg:#f4f6f8;--border:#dde4ea;--muted:#5c6b78;--danger:#b3423c}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:#1d2b36;padding:24px;max-width:960px;margin:0 auto}
h1{color:var(--navy);font-size:20px;margin-bottom:4px}
.sub{color:var(--muted);font-size:13px;margin-bottom:20px}
.card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px}
.card h2{font-size:15px;color:var(--navy);margin-bottom:8px}
label{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin:10px 0 4px}
input,select,textarea{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:8px;font-size:13.5px;font-family:inherit}
textarea{resize:vertical}
.btn{background:var(--navy);color:#fff;border:none;border-radius:8px;padding:9px 16px;font-size:13.5px;font-weight:600;cursor:pointer;margin-right:6px}
.btn.green{background:var(--green)}.btn.danger{background:var(--danger)}
.btn.ghost{background:#fff;color:var(--navy);border:1px solid var(--border)}
.stat{font-size:13px;color:var(--muted);margin-top:8px}
.ok{color:var(--green);font-weight:600}.err{color:var(--danger);font-weight:600}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
th,td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);vertical-align:top}
th{background:#eef2f5;color:var(--navy)}
td.ans{max-width:320px}
.topic{border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:8px}
.topic b{color:var(--navy)}
.topic .kw{font-size:12px;color:var(--muted)}
.topic .bd{font-size:12.5px;white-space:pre-wrap;margin-top:4px}
.mode{font-size:10.5px;font-weight:700;text-transform:uppercase;padding:1px 7px;border-radius:9px;margin-left:6px}
.mode.guide{background:#e3efe8;color:var(--green)}.mode.fixed{background:#fdf3dc;color:#a06a00}.mode.off{background:#eee;color:#888}
#main{display:none}
</style>
</head>
<body>
<h1>Hilliard Assistant — Admin</h1>
<div class="sub">Secure configuration for the resident chat agent</div>

<div class="card" id="loginCard">
  <h2>Sign in</h2>
  <label>Admin password</label>
  <input type="password" id="pw" onkeydown="if(event.key==='Enter')login()">
  <div style="margin-top:10px"><button class="btn green" onclick="login()">Sign in</button> <span id="loginMsg" class="stat"></span></div>
</div>

<div id="main">
  <div class="card">
    <h2>Status</h2>
    <div class="stat" id="status">Loading…</div>
  </div>

  <div class="card">
    <h2>Claude API key</h2>
    <div class="stat">The key is stored only in this Worker's KV storage — it is never sent to visitors' browsers. Entering a new key replaces the old one. The key is never displayed back.</div>
    <label>New API key</label>
    <input type="password" id="newKey" placeholder="sk-ant-…">
    <div style="margin-top:10px">
      <button class="btn green" onclick="setKey()">Save key</button>
      <button class="btn ghost" onclick="testKey()">Test stored key</button>
      <span id="keyMsg" class="stat"></span>
    </div>
    <label>Model</label>
    <select id="model">
      <option value="claude-sonnet-5">Claude Sonnet 5 (recommended)</option>
      <option value="claude-haiku-4-5">Claude Haiku 4.5 (faster, cheaper)</option>
      <option value="claude-opus-5">Claude Opus 5 (most capable)</option>
    </select>
    <div style="margin-top:10px"><button class="btn" onclick="setModel()">Save model</button> <span id="modelMsg" class="stat"></span></div>
  </div>

  <div class="card">
    <h2>Topic customizations</h2>
    <div class="stat">These apply to every visitor. <b>Guide the AI</b> adds instructions to answers on matching questions; <b>Fixed answer</b> replies with your exact text instantly (no AI call).</div>
    <div id="topicList"></div>
    <label>Topic name</label><input id="tName">
    <label>Keywords (comma-separated, whole-word match)</label><input id="tKw">
    <label>Mode</label>
    <select id="tMode"><option value="guide">Guide the AI</option><option value="fixed">Fixed answer</option></select>
    <label>Instructions or answer text</label><textarea id="tBody" rows="3"></textarea>
    <div style="margin-top:10px">
      <button class="btn green" id="tSave" onclick="saveTopic()">Add topic</button>
      <button class="btn ghost" id="tCancel" style="display:none" onclick="cancelTopic()">Cancel</button>
      <span id="topicMsg" class="stat"></span>
    </div>
  </div>

  <div class="card">
    <h2>Planning &amp; Zoning application list</h2>
    <div class="stat">The assistant searches the P&amp;Z Application Master List (project names, application types, zoning, locations, case numbers, approval dates). <b>Easiest method:</b> open the spreadsheet, select all the rows including the header row (Ctrl/Cmd+A), copy, and paste into the box below — then Save. No publishing or Microsoft sign-in needed. Repeat whenever the sheet changes. Only include columns appropriate for public view.</div>
    <label>Paste the spreadsheet here (Excel copy/paste, or CSV text)</label>
    <textarea id="projectsData" rows="6" placeholder="OpenGov Record	CASE #	…	PROJECT NAME	LOCATION	APPLICATION	ZONING	P&amp;Z APPROVAL…"></textarea>
    <div style="margin-top:10px">
      <button class="btn green" onclick="setProjectsData()">Save pasted list</button>
      <button class="btn ghost" onclick="clearProjectsData()">Clear pasted list</button>
      <span id="projectsMsg" class="stat"></span>
    </div>
    <label style="margin-top:14px">Or: published CSV link (used only when nothing is pasted above)</label>
    <input id="projectsCsv" placeholder="https://hilliardohio.github.io/chat/projects.csv">
    <div style="margin-top:10px">
      <button class="btn" onclick="setProjectsCsv()">Save link</button>
      <button class="btn ghost" onclick="refreshProjects()">Refresh &amp; test</button>
    </div>
    <div class="stat" id="projectsStatus"></div>
  </div>

  <div class="card">
    <h2>Q&amp;A log (all visitors)</h2>
    <div style="margin-top:4px">
      <button class="btn" onclick="loadLog()">Refresh</button>
      <button class="btn green" onclick="downloadCSV()">Download spreadsheet (CSV)</button>
      <button class="btn danger" onclick="clearLog()">Clear log</button>
      <span id="logMsg" class="stat"></span>
    </div>
    <div style="max-height:420px;overflow:auto">
      <table><thead><tr><th style="width:135px">Time</th><th>Question</th><th class="ans">Answer</th><th style="width:110px">Topic</th><th style="width:90px">Source</th></tr></thead><tbody id="logBody"></tbody></table>
    </div>
  </div>

  <div class="card">
    <h2>Knowledge base</h2>
    <div class="stat">The facts the assistant answers from. Edit and save — takes effect immediately for all visitors. City news is NOT stored here — it is pulled live from hilliardohio.gov/news automatically (refreshed every 6 hours). Live permit history in zoning letters requires the OPENGOV_API_KEY secret on the Worker (Settings &rarr; Variables); without it, letters link to the portal search instead.</div>
    <textarea id="kb" rows="16" style="font-family:ui-monospace,Menlo,monospace;font-size:12px;margin-top:8px"></textarea>
    <div style="margin-top:10px">
      <button class="btn green" onclick="saveKB()">Save knowledge base</button>
      <button class="btn ghost" onclick="loadKB()">Reload</button>
      <button class="btn ghost" onclick="resetKB()">Reset to built-in original</button>
      <span id="kbMsg" class="stat"></span>
    </div>
  </div>
</div>

<script>
let PW = '', topics = [], logEntries = [], editIdx = -1;
async function api(action, extra){
  const r = await fetch('/admin/api', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({password: PW, action, ...(extra||{})})});
  const d = await r.json();
  if(r.status === 401) { alert('Session expired — wrong password.'); location.reload(); }
  return {ok: r.ok, ...d};
}
async function login(){
  PW = document.getElementById('pw').value;
  const d = await api('status');
  if(d.error){ document.getElementById('loginMsg').innerHTML = '<span class="err">' + d.error + '</span>'; return; }
  document.getElementById('loginCard').style.display = 'none';
  document.getElementById('main').style.display = 'block';
  renderStatus(d);
}
function renderStatus(d){
  topics = d.topics || [];
  document.getElementById('status').innerHTML =
    'API key: ' + (d.hasKey ? '<span class="ok">set ✓</span>' : '<span class="err">NOT SET — assistant is offline</span>') +
    ' &nbsp;·&nbsp; Model: ' + d.model +
    ' &nbsp;·&nbsp; Questions today: ' + d.todayCount +
    ' &nbsp;·&nbsp; Log entries: ' + d.logCount + (d.logMore ? '+' : '') +
    ' &nbsp;·&nbsp; Knowledge base: ' + Math.round(d.kbLength/1000) + 'k chars' + (d.kbEdited ? ' (edited)' : ' (original)');
  document.getElementById('model').value = d.model;
  const pc = document.getElementById('projectsCsv');
  if(pc && !pc.value) pc.value = d.projectsCsvUrl || '';
  const ps = document.getElementById('projectsStatus');
  if(ps) ps.innerHTML = 'Source: ' + (d.projectsPasted ? '<b>pasted list</b>' : (d.projectsCsvUrl || (d.projectsDefaultUrl + ' <i>(default)</i>'))) +
    (d.projectsCount != null ? ' &nbsp;·&nbsp; <span class="ok">' + d.projectsCount + ' applications loaded</span> (' + new Date(d.projectsCachedAt).toLocaleString() + ')' : ' &nbsp;·&nbsp; <span class="err">not loaded yet</span>');
  renderTopics();
}
async function setProjectsData(){
  const t = document.getElementById('projectsData').value;
  if(!t.trim()){ document.getElementById('projectsMsg').innerHTML = '<span class="err">Paste the spreadsheet rows first.</span>'; return; }
  document.getElementById('projectsMsg').textContent = 'Saving…';
  const d = await api('set_projects_data', {data: t});
  document.getElementById('projectsMsg').innerHTML = d.ok ? '<span class="ok">✓ Loaded ' + d.count + ' applications.</span>' : '<span class="err">' + d.error + '</span>';
  if(d.ok) document.getElementById('projectsData').value = '';
  refreshStatus();
}
async function clearProjectsData(){
  if(!confirm('Remove the pasted Planning & Zoning list?')) return;
  const d = await api('set_projects_data', {data: ''});
  document.getElementById('projectsMsg').innerHTML = d.ok ? '<span class="ok">Cleared.</span>' : '<span class="err">' + d.error + '</span>';
  refreshStatus();
}
async function setProjectsCsv(){
  const d = await api('set_projects_csv', {url: document.getElementById('projectsCsv').value.trim()});
  document.getElementById('projectsMsg').innerHTML = d.ok ? '<span class="ok">Saved. Click Refresh &amp; test to load it.</span>' : '<span class="err">' + d.error + '</span>';
  refreshStatus();
}
async function refreshProjects(){
  document.getElementById('projectsMsg').textContent = 'Loading…';
  const d = await api('refresh_projects');
  document.getElementById('projectsMsg').innerHTML = d.ok ? '<span class="ok">✓ Loaded ' + d.count + ' applications.</span>' : '<span class="err">' + d.error + '</span>';
  refreshStatus();
}
async function refreshStatus(){ const d = await api('status'); if(!d.error) renderStatus(d); }
async function setKey(){
  const k = document.getElementById('newKey').value.trim();
  if(!k) return;
  const d = await api('set_key', {key: k});
  document.getElementById('keyMsg').innerHTML = d.ok ? '<span class="ok">Saved.</span>' : '<span class="err">' + d.error + '</span>';
  document.getElementById('newKey').value = '';
  refreshStatus();
}
async function testKey(){
  document.getElementById('keyMsg').textContent = 'Testing…';
  const d = await api('test_key');
  document.getElementById('keyMsg').innerHTML = d.ok ? '<span class="ok">✓ Key works.</span>' : '<span class="err">' + d.error + '</span>';
}
async function setModel(){
  const d = await api('set_model', {model: document.getElementById('model').value});
  document.getElementById('modelMsg').innerHTML = d.ok ? '<span class="ok">Saved.</span>' : '<span class="err">' + d.error + '</span>';
}
function renderTopics(){
  const el = document.getElementById('topicList');
  el.innerHTML = '';
  topics.forEach((t, i) => {
    const div = document.createElement('div');
    div.className = 'topic';
    const mode = t.enabled === false ? '<span class="mode off">Disabled</span>' : (t.mode === 'fixed' ? '<span class="mode fixed">Fixed answer</span>' : '<span class="mode guide">Guides AI</span>');
    div.innerHTML = '<b></b>' + mode +
      ' <span style="float:right"><button class="btn ghost" style="padding:3px 9px;font-size:12px" onclick="toggleTopic(' + i + ')">' + (t.enabled === false ? 'Enable' : 'Disable') + '</button> <button class="btn ghost" style="padding:3px 9px;font-size:12px" onclick="editTopic(' + i + ')">Edit</button> <button class="btn danger" style="padding:3px 9px;font-size:12px" onclick="delTopic(' + i + ')">Delete</button></span>' +
      '<div class="kw"></div><div class="bd"></div>';
    div.querySelector('b').textContent = t.name;
    div.querySelector('.kw').textContent = 'Keywords: ' + t.keywords;
    div.querySelector('.bd').textContent = t.body;
    el.appendChild(div);
  });
}
async function pushTopics(msg){
  const d = await api('set_topics', {topics});
  document.getElementById('topicMsg').innerHTML = d.ok ? '<span class="ok">' + (msg || 'Saved.') + '</span>' : '<span class="err">' + d.error + '</span>';
  renderTopics();
}
function saveTopic(){
  const t = {
    id: editIdx >= 0 ? topics[editIdx].id : 't' + Date.now(),
    name: document.getElementById('tName').value.trim(),
    keywords: document.getElementById('tKw').value.trim(),
    mode: document.getElementById('tMode').value,
    body: document.getElementById('tBody').value.trim(),
    enabled: editIdx >= 0 ? topics[editIdx].enabled !== false : true
  };
  if(!t.name || !t.keywords || !t.body){ alert('Fill in name, keywords, and text.'); return; }
  if(editIdx >= 0) topics[editIdx] = t; else topics.push(t);
  cancelTopic(); pushTopics();
}
function editTopic(i){
  editIdx = i;
  document.getElementById('tName').value = topics[i].name;
  document.getElementById('tKw').value = topics[i].keywords;
  document.getElementById('tMode').value = topics[i].mode;
  document.getElementById('tBody').value = topics[i].body;
  document.getElementById('tSave').textContent = 'Save changes';
  document.getElementById('tCancel').style.display = '';
}
function cancelTopic(){
  editIdx = -1;
  ['tName','tKw','tBody'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('tMode').value = 'guide';
  document.getElementById('tSave').textContent = 'Add topic';
  document.getElementById('tCancel').style.display = 'none';
}
function toggleTopic(i){ topics[i].enabled = topics[i].enabled === false; pushTopics(); }
function delTopic(i){ if(confirm('Delete "' + topics[i].name + '"?')){ topics.splice(i, 1); pushTopics('Deleted.'); } }
async function loadLog(){
  document.getElementById('logMsg').textContent = 'Loading…';
  const d = await api('get_log');
  if(d.error){ document.getElementById('logMsg').innerHTML = '<span class="err">' + d.error + '</span>'; return; }
  logEntries = d.entries;
  document.getElementById('logMsg').textContent = logEntries.length + ' entries' + (d.complete ? '' : ' (showing most recent 1000)');
  const body = document.getElementById('logBody');
  body.innerHTML = '';
  logEntries.forEach(e => {
    const tr = document.createElement('tr');
    [new Date(e.ts).toLocaleString(), e.question, e.answer.length > 240 ? e.answer.slice(0,240) + '…' : e.answer, e.topic, e.source].forEach((c, i) => {
      const td = document.createElement('td'); if(i === 2) td.className = 'ans'; td.textContent = c; tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}
function csvCell(v){ return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
function downloadCSV(){
  if(!logEntries.length){ alert('Load the log first (Refresh).'); return; }
  const rows = [['Timestamp','Question','Answer','Topic','Source']];
  logEntries.forEach(e => rows.push([new Date(e.ts).toLocaleString(), e.question, e.answer, e.topic, e.source]));
  const csv = '\\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\\r\\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv;charset=utf-8'}));
  a.download = 'hilliard-chat-log-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}
async function clearLog(){
  if(!confirm('Delete all logged questions? Download the CSV first if you want to keep them.')) return;
  const d = await api('clear_log');
  document.getElementById('logMsg').textContent = d.ok ? 'Cleared ' + d.deleted + ' entries.' : d.error;
  loadLog();
}
async function loadKB(){
  const d = await api('get_kb');
  if(!d.error){ document.getElementById('kb').value = d.kb; document.getElementById('kbMsg').textContent = ''; }
}
async function saveKB(){
  const d = await api('set_kb', {kb: document.getElementById('kb').value});
  document.getElementById('kbMsg').innerHTML = d.ok ? '<span class="ok">Saved — live for all visitors.</span>' : '<span class="err">' + d.error + '</span>';
  refreshStatus();
}
async function resetKB(){
  if(!confirm('Replace edits with the built-in original knowledge base?')) return;
  await api('reset_kb'); loadKB(); refreshStatus();
}
// auto-load KB when main is shown
new MutationObserver(() => { if(document.getElementById('main').style.display === 'block'){ loadKB(); loadLog(); } }).observe(document.getElementById('main'), {attributes: true});
</script>
</body>
</html>`;
