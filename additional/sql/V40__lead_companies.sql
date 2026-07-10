-- =====================================================================
-- Nolyvra Lead Pool — Company Records (Real Estate, Sydney pilot batch)
-- =====================================================================
-- Purpose: store enrichment-style company records locally instead of
-- fetching live from Bright Data every time. Supports multiple sectors
-- (real_estate is the first) and multiple geographic regions.
--
-- Fetch behaviour this schema supports:
--   - Every client "fetch" call returns up to 10 records: 5 random rows
--     already cached here (if present for the search term) + 5 fresh
--     records pulled live from Bright Data, deduped against what's
--     already cached for that term.
--   - "Load more" repeats the same 5-cached + 5-fresh operation for the
--     same search term — stateless, so each click is just another call.
--   - last_fetched_at / fetch_count track rotation so repeat "5 cached"
--     picks aren't always the same handful of rows.
--
-- Target: ~500 records total, built in iterative batches (this file = 10).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS lead_companies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         VARCHAR(50) UNIQUE NOT NULL, -- human-readable natural key, e.g. 'RE-SYD-0001'
    sector              VARCHAR(100) NOT NULL DEFAULT 'real_estate', -- lets you add other sectors later
    region              VARCHAR(150), -- free-text sub-region label, e.g. 'Eastern Suburbs, Sydney'
    data                JSONB NOT NULL, -- full enrichment payload, CoreSignal-shaped (see structure below)
    source              VARCHAR(50) NOT NULL DEFAULT 'manual_research', -- manual_research | brightdata
    is_active           BOOLEAN NOT NULL DEFAULT TRUE, -- soft-delete / exclude from rotation
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_fetched_at     TIMESTAMPTZ, -- NULL until first served by the batch-fetch endpoint
    fetch_count         INT NOT NULL DEFAULT 0 -- number of times this record has been served
);

-- Speeds up sector filtering
CREATE INDEX IF NOT EXISTS idx_lead_companies_sector
    ON lead_companies (sector);

-- Speeds up the "least-served-first" rotation query below
CREATE INDEX IF NOT EXISTS idx_lead_companies_rotation
    ON lead_companies (sector, is_active, fetch_count ASC, last_fetched_at ASC NULLS FIRST);

-- Lets you query inside the JSON payload efficiently (e.g. filter by industry, city)
CREATE INDEX IF NOT EXISTS idx_lead_companies_data_gin
    ON lead_companies USING GIN (data jsonb_path_ops);

-- =====================================================================
-- data JSONB structure (per record) — matches the CoreSignal field map:
-- {
--   "name": ..., "industry": ..., "size_range": ..., "size_employees_count": ...,
--   "location_hq_city": ..., "location_hq_country": ...,
--   "description": ..., "founded": ..., "type": ...,
--   "websites_main": ..., "websites_linkedin": ...,
--   "active_job_postings_count": ...,
--   "employees_count_change": { "change_yearly_percentage": ... },
--   "active_job_postings_count_change": { "change_monthly_percentage": ... },
--   "last_funding_round": ...,
--   "key_executives": [ { "member_full_name": ..., "member_position_title": ... } ],
--   "specialities": [ ... ],
--   "news_articles": [ { "headline": ... } ]
-- }
--
-- Fields left NULL below are genuinely not sourceable via web research —
-- mainly employees_count_change / active_job_postings_count_change
-- (require historical time-series data we don't have) and a few founding
-- years / executive names where public sources conflicted or were silent.
-- =====================================================================

INSERT INTO lead_companies (external_id, sector, region, data, source) VALUES

('RE-SYD-0001', 'real_estate', 'Inner City / Eastern Suburbs / Inner West, Sydney', $json$
{
  "name": "BresicWhitney",
  "industry": "Real Estate",
  "size_range": "51-200",
  "size_employees_count": null,
  "location_hq_city": "Darlinghurst",
  "location_hq_country": "Australia",
  "description": "Sydney's leading independent property group, covering residential sales and property management across the Inner City, Eastern Suburbs, Inner West, Hunters Hill and Lower North Shore.",
  "founded": 2003,
  "type": "Privately Held",
  "websites_main": "https://bresicwhitney.com.au",
  "websites_linkedin": "https://www.linkedin.com/company/bresic-whitney",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Thomas McGlynn", "member_position_title": "Chief Executive Officer" },
    { "member_full_name": "Shannan Whitney", "member_position_title": "Co-Founder & Director" }
  ],
  "specialities": ["Residential Sales", "Residential Property Management"],
  "news_articles": [
    { "headline": "BresicWhitney acquires top-performing Eastern Suburbs business The Woollahra Group" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0002', 'real_estate', 'Sydney-wide (HQ Pyrmont)', $json$
{
  "name": "McGrath Estate Agents",
  "industry": "Real Estate",
  "size_range": "1001-5000",
  "size_employees_count": null,
  "location_hq_city": "Pyrmont",
  "location_hq_country": "Australia",
  "description": "One of Australia's largest residential real estate networks, listed on the ASX, offering residential sales, property management, projects and home loan services across NSW, ACT, QLD and VIC.",
  "founded": 1988,
  "type": "Public Company (ASX: MEA)",
  "websites_main": "https://www.mcgrath.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/mcgrath-estate-agents",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "John McGrath", "member_position_title": "Founder, Managing Director & Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Residential Projects", "Home Loans"],
  "news_articles": [
    { "headline": "John McGrath appointed Chief Executive Officer of McGrath Estate Agents" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0003', 'real_estate', 'National network (Sydney-based)', $json$
{
  "name": "The Agency Group Australia",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "National real estate group operating a non-franchise model across residential sales, property management, project marketing and finance; listed on the ASX.",
  "founded": null,
  "type": "Public Company (ASX: AU1)",
  "websites_main": "https://theagency.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/the-agency-real-estate-australia",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Geoff Lucas", "member_position_title": "Chief Executive Officer & Managing Director" },
    { "member_full_name": "Matt Lahood", "member_position_title": "Executive Director" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Project Marketing", "Finance"],
  "news_articles": [
    { "headline": "The Agency completes Top Level acquisition, continues strong organic growth" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0004', 'real_estate', 'National network (Sydney HQ)', $json$
{
  "name": "Belle Property",
  "industry": "Real Estate",
  "size_range": "1001-5000",
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "Boutique full-service real estate franchise network catering to premium and middle markets, with more than 200 offices across NSW, VIC, QLD, SA, WA, TAS and ACT.",
  "founded": 2000,
  "type": "Privately Held",
  "websites_main": "https://www.belleproperty.com",
  "websites_linkedin": "https://au.linkedin.com/company/belleproperty",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Nick Boyd", "member_position_title": "Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Short-Stay Services"],
  "news_articles": [
    { "headline": "Belle Property expands in Western Sydney with new Nepean office" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0005', 'real_estate', 'Eastern Suburbs, Sydney', $json$
{
  "name": "PPD Real Estate",
  "industry": "Real Estate",
  "size_range": "51-200",
  "size_employees_count": 60,
  "location_hq_city": "Woollahra",
  "location_hq_country": "Australia",
  "description": "Independent real estate agency operating across Sydney's Eastern Suburbs, Lower North Shore and Southern Beaches, spanning sales, property management and marketing.",
  "founded": 2013,
  "type": "Privately Held",
  "websites_main": "https://www.ppdre.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/ppd-real-estate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [],
  "specialities": ["Residential Sales", "Property Management", "Marketing"],
  "news_articles": [
    { "headline": "Back With A Bang And A Shiny New 2026 Office" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0006', 'real_estate', 'Northern Beaches, Sydney', $json$
{
  "name": "Cunninghams Real Estate",
  "industry": "Real Estate",
  "size_range": "51-200",
  "size_employees_count": 70,
  "location_hq_city": "Balgowlah",
  "location_hq_country": "Australia",
  "description": "Independent, family-run real estate agency serving Sydney's Northern Beaches across residential sales and property management.",
  "founded": 1991,
  "type": "Privately Held",
  "websites_main": "https://www.cunninghamsre.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/cunninghamsre",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "John Cunningham", "member_position_title": "Founder & Principal Director" }
  ],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0007', 'real_estate', 'Northern Beaches / Sydney-wide network', $json$
{
  "name": "Stone Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Manly",
  "location_hq_country": "Australia",
  "description": "Franchise real estate network operating across Sydney and regional NSW with a centralised database model, covering residential sales and property management.",
  "founded": null,
  "type": "Privately Held",
  "websites_main": "https://www.stonerealestate.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/stone-real-estate-",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Peter Mumford", "member_position_title": "Founder & Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Franchise Network"],
  "news_articles": [
    { "headline": "Stone Real Estate launches newest office, Stone Bateau Bay" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0008', 'real_estate', 'Western Sydney', $json$
{
  "name": "Starr Partners",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Blacktown",
  "location_hq_country": "Australia",
  "description": "Boutique real estate group operating across Western Sydney, offering residential sales, property management and strata management services.",
  "founded": null,
  "type": "Privately Held",
  "websites_main": "https://www.starrpartners.com.au",
  "websites_linkedin": null,
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Douglas Driscoll", "member_position_title": "Chief Executive Officer & Owner" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Strata Management"],
  "news_articles": [
    { "headline": "Starr Partners opens doors to Parramatta" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0009', 'real_estate', 'National network (Sydney HQ)', $json$
{
  "name": "Raine & Horne",
  "industry": "Real Estate",
  "size_range": "1001-5000",
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "One of Australia's oldest family-owned real estate franchise networks, offering residential, commercial, rural and finance services nationally and internationally.",
  "founded": 1883,
  "type": "Privately Held",
  "websites_main": "https://www.raineandhorne.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/raine-&-horne",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Angus Raine", "member_position_title": "Executive Chairman" }
  ],
  "specialities": ["Property Marketing", "Franchise", "Residential", "Commercial", "Rural", "Finance"],
  "news_articles": [
    { "headline": "Raine & Horne celebrates 140 years of success" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0010', 'real_estate', 'National network (Sydney HQ)', $json$
{
  "name": "LJ Hooker",
  "industry": "Real Estate",
  "size_range": "1001-5000",
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "One of Australia's largest and longest-running real estate franchise networks, offering residential and commercial sales, property management and finance services across Australia and New Zealand.",
  "founded": 1928,
  "type": "Privately Held",
  "websites_main": "https://www.ljhooker.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/lj-hooker",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [],
  "specialities": ["Residential Sales", "Commercial Real Estate", "Property Management", "Finance"],
  "news_articles": [
    { "headline": "LJ Hooker network expands in Perth's high-growth north coast region" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0011', 'real_estate', 'Metropolitan Sydney network (HQ Dee Why)', $json$
{
  "name": "Laing+Simmons",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Dee Why",
  "location_hq_country": "Australia",
  "description": "Boutique network of independent real estate agencies across metropolitan Sydney and regional NSW, offering residential and commercial sales, leasing and property management.",
  "founded": 1967,
  "type": "Privately Held",
  "websites_main": "https://lsre.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/laing-simmons",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Leanne Pilkington", "member_position_title": "Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Project Marketing", "Franchising"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0012', 'real_estate', 'National network (NSW & QLD), HQ Sydney', $json$
{
  "name": "Richardson & Wrench",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "One of Australia's oldest real estate companies, offering residential and commercial sales, leasing and property management through a franchise network across NSW and QLD.",
  "founded": 1858,
  "type": "Privately Held",
  "websites_main": "https://www.randw.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/richardson-&-wrench-national-hq",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Andrew Cocks", "member_position_title": "Managing Director & Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Franchising"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0013', 'real_estate', 'National network, HQ Sydney', $json$
{
  "name": "Century 21 Australia",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Sydney",
  "location_hq_country": "Australia",
  "description": "Australian-owned arm of the global Century 21 real estate network, operating over 150 independently owned and operated offices across NSW, QLD, NT, WA, VIC, TAS and New Zealand.",
  "founded": 1994,
  "type": "Privately Held",
  "websites_main": "https://www.century21.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/century-21-australia",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Charles Tarbey", "member_position_title": "Chairman & Owner" },
    { "member_full_name": "Ray Ellis", "member_position_title": "Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Franchising"],
  "news_articles": [
    { "headline": "Ray Ellis appointed CEO of CENTURY 21 Australia" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0014', 'real_estate', 'National network (subscription model), HQ Wollongong (Greater Sydney region)', $json$
{
  "name": "One Agency",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Wollongong",
  "location_hq_country": "Australia",
  "description": "Subscription-based real estate network allowing agents and agencies to operate independently while retaining commission, with over 150 businesses across Australia, New Zealand and Fiji.",
  "founded": 2008,
  "type": "Privately Held",
  "websites_main": "https://www.oneagencygroup.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/one-agency-group",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Paul Davies", "member_position_title": "Founder & Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Subscription-Based Franchise Model"],
  "news_articles": [
    { "headline": "One Agency capitalises on booming South West Sydney market" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0015', 'real_estate', 'National franchise network with NSW/Sydney offices; HQ Fortitude Valley, QLD', $json$
{
  "name": "PRD Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Fortitude Valley",
  "location_hq_country": "Australia",
  "description": "Research-backed real estate franchise network with over 80 offices across Australia including NSW, owned by Colliers International since 2006.",
  "founded": 1976,
  "type": "Privately Held (subsidiary of Colliers International)",
  "websites_main": "https://www.prd.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/prdrealestate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Todd Hadley", "member_position_title": "Managing Director" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Sales", "Project Marketing", "Rural Property"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0016', 'real_estate', 'National network with NSW/Sydney offices; HQ Adelaide, SA', $json$
{
  "name": "Elders Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Adelaide",
  "location_hq_country": "Australia",
  "description": "One of Australia's most established real estate and agribusiness brands, operating close to 300 offices nationally across residential, rural and commercial property; part of ASX-listed Elders Limited.",
  "founded": 1839,
  "type": "Public Company (ASX: ELD)",
  "websites_main": "https://www.eldersrealestate.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/elders-real-estate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Mark Allison", "member_position_title": "Managing Director & Chief Executive Officer, Elders Limited" }
  ],
  "specialities": ["Residential Sales", "Rural & Agribusiness Real Estate", "Commercial Real Estate", "Property Management"],
  "news_articles": [
    { "headline": "Elders appoints John Talbot to lead commercial real estate expansion" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0017', 'real_estate', 'Sydney, Central Coast, Southern Highlands & Illawarra network; HQ Paddington', $json$
{
  "name": "DiJones Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Paddington",
  "location_hq_country": "Australia",
  "description": "New South Wales' largest independent real estate agency, offering residential and commercial sales and property management across Sydney, the Central Coast, Southern Highlands and Illawarra.",
  "founded": 1992,
  "type": "Privately Held",
  "websites_main": "https://www.dijones.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/dijonesrealestate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Dean Mackie", "member_position_title": "Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Sales", "Property Leasing"],
  "news_articles": [
    { "headline": "DiJones heads home with new Woollahra office" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0018', 'real_estate', 'Eastern Suburbs, Sydney (HQ Double Bay)', $json$
{
  "name": "Bradfield Cleary",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Double Bay",
  "location_hq_country": "Australia",
  "description": "Long-established Eastern Suburbs real estate agency tracing its origins to 1927, offering residential sales and property management.",
  "founded": 1927,
  "type": "Privately Held",
  "websites_main": "https://www.bradfieldcleary.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/bradfield-cleary-real-estate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0019', 'real_estate', 'Inner West & Lower North Shore, Sydney (HQ Balmain)', $json$
{
  "name": "CobdenHayson",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Balmain",
  "location_hq_country": "Australia",
  "description": "Independent real estate network covering Sydney's Inner West and Lower North Shore, with offices in Balmain, Annandale, Drummoyne, Earlwood, Marrickville, Lane Cove and Petersham.",
  "founded": 2005,
  "type": "Privately Held",
  "websites_main": "https://www.ch.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/cobdenhayson",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Danny Cobden", "member_position_title": "Director" },
    { "member_full_name": "Matthew Hayson", "member_position_title": "Director" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Sales", "Commercial Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0020', 'real_estate', 'Inner West, Sydney (Strathfield, Drummoyne, Concord, Marrickville/Dulwich Hill)', $json$
{
  "name": "Devine Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Strathfield",
  "location_hq_country": "Australia",
  "description": "Family-owned real estate agency and a leading brand in Sydney's Inner West, formed through the acquisition of multiple local offices including former First National, Laing+Simmons, Century 21 and LJ Hooker franchises.",
  "founded": 1955,
  "type": "Privately Held",
  "websites_main": null,
  "websites_linkedin": null,
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Steven Devine", "member_position_title": "Director" }
  ],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0021', 'real_estate', 'National cooperative network with NSW/Sydney member offices; HQ Richmond, VIC', $json$
{
  "name": "First National Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Richmond",
  "location_hq_country": "Australia",
  "description": "Australasian cooperative network of independent real estate agents established in 1981, with over 300 member offices across Australia, New Zealand, Papua New Guinea and Vanuatu.",
  "founded": 1981,
  "type": "Privately Held (member-owned cooperative)",
  "websites_main": "https://www.firstnational.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/first-national-real-estate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "David Edwards", "member_position_title": "Chief Executive Officer" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Rural Property"],
  "news_articles": [
    { "headline": "First National Real Estate announces appointment of David Edwards as Chief Executive Officer" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0022', 'real_estate', 'National network with NSW/Sydney offices', $json$
{
  "name": "Harcourts Australia",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": null,
  "location_hq_country": "Australia",
  "description": "Australian arm of the New Zealand-founded Harcourts International real estate network, offering residential, commercial and rural real estate services since entering the Australian market in 1997.",
  "founded": 1997,
  "type": "Privately Held",
  "websites_main": "https://www.harcourts.net/au",
  "websites_linkedin": "https://www.linkedin.com/company/harcourts",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Adrian Knowles", "member_position_title": "Chief Executive Officer, Harcourts Australia" },
    { "member_full_name": "Andrew McCulloch", "member_position_title": "Chief Executive Officer, NSW & ACT" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Rural Real Estate"],
  "news_articles": [
    { "headline": "Andrew McCulloch named as Harcourts NSW CEO" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0023', 'real_estate', 'Sutherland Shire, South Sydney (Kirrawee, Menai, Engadine, Sylvania, Cronulla)', $json$
{
  "name": "Ray White Sutherland Shire",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Sylvania",
  "location_hq_country": "Australia",
  "description": "Multi-office Ray White franchise group servicing the Sutherland Shire across sales and property management, with offices in Kirrawee, Menai, Engadine, Sylvania and Cronulla.",
  "founded": 2006,
  "type": "Privately Held (Ray White franchise)",
  "websites_main": "https://raywhitesutherlandshire.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/ray-white-sutherland-shire--sutherland",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0024', 'real_estate', 'Blue Mountains (Greater Sydney), NSW', $json$
{
  "name": "Chapman Real Estate",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Blaxland",
  "location_hq_country": "Australia",
  "description": "Boutique real estate group servicing the Blue Mountains region of Greater Sydney, with offices in Blaxland, Glenbrook, Springwood, Winmalee, Leura and Katoomba.",
  "founded": 1987,
  "type": "Privately Held",
  "websites_main": "https://www.chapmanrealestate.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/chapmanrealestate",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Phillip Chapman", "member_position_title": "Founder" }
  ],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0025', 'real_estate', 'Hills District, Sydney', $json$
{
  "name": "Ray White Castle Hill",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Castle Hill",
  "location_hq_country": "Australia",
  "description": "Locally owned Ray White franchise office servicing Sydney's Hills District across residential sales, property management and investment portfolio guidance.",
  "founded": null,
  "type": "Privately Held (Ray White franchise)",
  "websites_main": "https://raywhitecastlehill.com.au",
  "websites_linkedin": null,
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Philip Kelly", "member_position_title": "Managing Director & Licensee in Charge" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Property Investment"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0026', 'real_estate', 'South West Sydney (Green Valley, Hinchinbrook, Liverpool, Fairfield)', $json$
{
  "name": "Ray White Green Valley",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Green Valley",
  "location_hq_country": "Australia",
  "description": "Family-run Ray White franchise office servicing South West Sydney's Green Valley, Hinchinbrook, Liverpool and Fairfield areas for over 30 years, across sales and property management.",
  "founded": null,
  "type": "Privately Held (Ray White franchise)",
  "websites_main": "https://raywhitegreenvalley.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/ray-white-green-valley",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [],
  "specialities": ["Residential Sales", "Property Management"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0027', 'real_estate', 'Upper North Shore, Sydney (HQ Lindfield)', $json$
{
  "name": "McConnell Bourn",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Lindfield",
  "location_hq_country": "Australia",
  "description": "Independent boutique real estate agency specialising in Sydney's North Shore, offering luxury residential and commercial sales, property management and investment advisory.",
  "founded": 2000,
  "type": "Privately Held",
  "websites_main": "https://www.mcconnellbourn.com.au",
  "websites_linkedin": "https://au.linkedin.com/company/mcconnell-bourn",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Matthew Bourn", "member_position_title": "Chief Executive Officer & Managing Director" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Sales", "Investment Advisory"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0028', 'real_estate', 'Sutherland Shire, Eastern Suburbs, Inner West, Southern Highlands, Sydney-wide network', $json$
{
  "name": "Highland Property Group",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Sutherland",
  "location_hq_country": "Australia",
  "description": "Independent real estate network founded in the Sutherland Shire, now spanning Sydney's Eastern Suburbs, Inner West, Southern Highlands and the Gold Coast, offering residential and commercial sales, property management and finance services.",
  "founded": 2007,
  "type": "Privately Held",
  "websites_main": "https://www.highlandproperty.com.au",
  "websites_linkedin": null,
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "David Highland", "member_position_title": "Chief Executive Officer & Founder" }
  ],
  "specialities": ["Residential Sales", "Property Management", "Commercial Sales", "Project Marketing", "Financial Services"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0029', 'real_estate', 'Southern Highlands, NSW (Greater Sydney region)', $json$
{
  "name": "Drew Lindsay Sotheby's International Realty",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Bowral",
  "location_hq_country": "Australia",
  "description": "Fifth-generation Southern Highlands real estate agency operating under the global Sotheby's International Realty luxury brokerage network.",
  "founded": null,
  "type": "Privately Held (Sotheby's International Realty affiliate)",
  "websites_main": "https://drewlindsaysir.com",
  "websites_linkedin": null,
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Samuel Lindsay", "member_position_title": "Principal" }
  ],
  "specialities": ["Luxury Residential Sales", "Rural & Lifestyle Property"],
  "news_articles": []
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0030', 'real_estate', 'Eastern Suburbs, Sydney (HQ Rose Bay)', $json$
{
  "name": "The Rubinstein Group (TRG)",
  "industry": "Real Estate",
  "size_range": null,
  "size_employees_count": null,
  "location_hq_city": "Rose Bay",
  "location_hq_country": "Australia",
  "description": "Luxury real estate agency operating under the Ray White network, specialising in Sydney's Eastern Suburbs prestige property market across sales and property management.",
  "founded": 2020,
  "type": "Privately Held (Ray White network)",
  "websites_main": "https://www.therubinsteingroup.com",
  "websites_linkedin": "https://au.linkedin.com/company/thrubinsteingroup",
  "active_job_postings_count": null,
  "employees_count_change": { "change_yearly_percentage": null },
  "active_job_postings_count_change": { "change_monthly_percentage": null },
  "last_funding_round": null,
  "key_executives": [
    { "member_full_name": "Gavin Rubinstein", "member_position_title": "Founder" }
  ],
  "specialities": ["Luxury Residential Sales", "Property Management"],
  "news_articles": [
    { "headline": "Gavin Rubinstein is the first Ray White agent to reach 'elite' status this financial year" }
  ]
}
$json$::jsonb, 'manual_research'),

('RE-SYD-0031', 'real_estate', 'Hills District / North West Sydney (Baulkham Hills, Castle Hill, Dural, Seven Hills, Beaumont Hills)', $json$
{ "name": "Manor Real Estate", "industry": "Real Estate", "size_range": "51-100", "size_employees_count": null, "location_hq_city": "Baulkham Hills", "location_hq_country": "Australia", "description": "Independently run boutique real estate agency and leading agency in Sydney's Hills District, offering residential sales and property management across Baulkham Hills, Castle Hill, Dural, Seven Hills and Beaumont Hills.", "founded": 2016, "type": "Privately Held", "websites_main": "https://www.manorrealestate.com.au", "websites_linkedin": "https://au.linkedin.com/company/manorre-au", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Jay Bacani", "member_position_title": "Co-Founder & Director" }, { "member_full_name": "Igor Jugovic", "member_position_title": "Co-Founder & Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0032', 'real_estate', 'Mount Druitt, Western Sydney', $json$
{ "name": "Elite Agency - The Jajaw Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Mount Druitt", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Mount Druitt and surrounding Western Sydney suburbs across residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": "https://www.theeliteagency.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Wiltar Jajaw", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0033', 'real_estate', 'St Marys, Western Sydney', $json$
{ "name": "Ray White Diamantidis Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "St Marys", "location_hq_country": "Australia", "description": "Ray White franchise office servicing St Marys and Western Sydney, specialising in residential sales including development blocks and off-the-plan projects.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Peter Diamantidis", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0034', 'real_estate', 'Parramatta, Western Sydney', $json$
{ "name": "Century 21 Davelis & Co", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Parramatta", "location_hq_country": "Australia", "description": "Century 21 franchise office servicing Parramatta and Western Sydney across residential sales and property management.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0035', 'real_estate', 'Bondi Junction, Eastern Suburbs, Sydney', $json$
{ "name": "Century 21 Armstrong-Smith", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Bondi Junction", "location_hq_country": "Australia", "description": "Century 21 franchise office covering Bondi Junction, Bondi, Centennial Park and Randwick across residential and commercial real estate.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": "https://c21armstrong-smith.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0036', 'real_estate', 'Parramatta, Western Sydney', $json$
{ "name": "Harcourts Exclusive", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Parramatta", "location_hq_country": "Australia", "description": "Harcourts franchise office in Parramatta specialising in residential property management and leasing.", "founded": null, "type": "Privately Held (Harcourts franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0037', 'real_estate', 'North Parramatta, Western Sydney', $json$
{ "name": "Hunters Agency & Co", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "North Parramatta", "location_hq_country": "Australia", "description": "Independent real estate agency servicing North Parramatta and surrounds across residential sales, project marketing and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Project Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0038', 'real_estate', 'Parramatta, Western Sydney', $json$
{ "name": "Ray White Parramatta Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Parramatta", "location_hq_country": "Australia", "description": "Ray White franchise group servicing Parramatta, among the top-selling real estate offices in the area by property sales volume.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteparramatta.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0039', 'real_estate', 'St Marys, Western Sydney', $json$
{ "name": "Ray White United Group | St Marys", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "St Marys", "location_hq_country": "Australia", "description": "Ray White franchise office servicing St Marys and Western Sydney, among the highest-volume property sellers in the Sydney metro area.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0040', 'real_estate', 'Epping, Chatswood, Castle Hill - North Shore / North West Sydney', $json$
{ "name": "Tracy Yap Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Epping", "location_hq_country": "Australia", "description": "Independent real estate network with offices across Epping, Chatswood and Castle Hill, servicing Sydney's North Shore and North West.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0041', 'real_estate', 'Chatswood, North Shore, Sydney', $json$
{ "name": "Century 21 Seiwa", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Chatswood", "location_hq_country": "Australia", "description": "Century 21 franchise office covering Chatswood, Lane Cove, St Leonards and Willoughby across residential, commercial and project sales.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": "https://chatswood.century21.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Claire Yan Liu", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Project Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0042', 'real_estate', 'Chatswood / North Shore, with reach across Sydney', $json$
{ "name": "Kennedy Learmont", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Chatswood", "location_hq_country": "Australia", "description": "Industrial, commercial and retail real estate specialist based in Chatswood with 20+ years of experience, servicing North Shore property management with reach into the Hills District, Northern Beaches and Southern Sydney.", "founded": null, "type": "Privately Held", "websites_main": "https://www.kennedylearmont.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Commercial Real Estate", "Industrial Real Estate", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0043', 'real_estate', 'Crows Nest, Lower North Shore, Sydney', $json$
{ "name": "Holmes St Clair", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Crows Nest", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Crows Nest and the Lower North Shore.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0044', 'real_estate', 'Crows Nest, Lower North Shore, Sydney', $json$
{ "name": "Marriott Lane Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Crows Nest", "location_hq_country": "Australia", "description": "Independent real estate agency operating sales and rentals divisions in Crows Nest on Sydney's Lower North Shore.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0045', 'real_estate', 'Chatswood, North Shore, Sydney', $json$
{ "name": "Ray White AY Realty Chatswood", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Chatswood", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Chatswood and the surrounding Lower North Shore.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0046', 'real_estate', 'Mosman / Lower North Shore, Sydney', $json$
{ "name": "Ray White Lower North Shore Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Mosman", "location_hq_country": "Australia", "description": "Ray White franchise group servicing Sydney's Lower North Shore including Mosman and surrounding suburbs.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0047', 'real_estate', 'Neutral Bay, Lower North Shore, Sydney', $json$
{ "name": "Belle Property Lower North Shore - Neutral Bay", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Neutral Bay", "location_hq_country": "Australia", "description": "Belle Property franchise office servicing Neutral Bay and Sydney's Lower North Shore across residential sales and property management.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0048', 'real_estate', 'Annandale, Newtown, Stanmore, Leichhardt - Inner West, Sydney', $json$
{ "name": "Ray White Inner West Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Annandale", "location_hq_country": "Australia", "description": "Ray White franchise group servicing Sydney's Inner West from offices in Annandale, Newtown, Stanmore and Leichhardt, established by its founding principals in 1998.", "founded": 1998, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteinnerwest.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0049', 'real_estate', 'Newtown, Marrickville, Inner West, Sydney', $json$
{ "name": "Adrian William Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Newtown", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Newtown, Marrickville and the broader Inner West across sales and property management, operating for close to two decades.", "founded": null, "type": "Privately Held", "websites_main": "https://adrianwilliam.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0050', 'real_estate', 'Leichhardt, Inner West, Sydney', $json$
{ "name": "Gerard Partners Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Leichhardt", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Leichhardt, Lilyfield and the Inner West across residential sales.", "founded": null, "type": "Privately Held", "websites_main": "https://www.gerardpartners.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0051', 'real_estate', 'Balmain, Inner West, Sydney', $json$
{ "name": "Harris Partners", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Balmain", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Balmain and the Inner West.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0052', 'real_estate', 'Balmain / Leichhardt, Inner West, Sydney', $json$
{ "name": "The Agency Inner West", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Balmain", "location_hq_country": "Australia", "description": "The Agency franchise office servicing Sydney's Inner West including Balmain and Leichhardt.", "founded": null, "type": "Privately Held (The Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0053', 'real_estate', 'St George / Ramsgate, South Sydney', $json$
{ "name": "Century 21 Bayview", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ramsgate", "location_hq_country": "Australia", "description": "Century 21 franchise office servicing the St George region including Ramsgate, Rockdale, Brighton-Le-Sands and Sans Souci.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0054', 'real_estate', 'Marrickville / St George / Inner West / Eastern Suburbs / Canterbury-Bankstown, Sydney', $json$
{ "name": "NextGen Property Management", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Marrickville", "location_hq_country": "Australia", "description": "Boutique property management agency headquartered in Marrickville, specialising in the Inner West, St George, Eastern Suburbs and Canterbury-Bankstown regions of Sydney.", "founded": 2017, "type": "Privately Held", "websites_main": "https://nextgenpm.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Chris Dimitropoulos", "member_position_title": "Founder & Licensee in Charge" } ], "specialities": ["Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0055', 'real_estate', 'St George / Hurstville, South Sydney', $json$
{ "name": "HT Wills Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Hurstville", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Hurstville and the St George region.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0056', 'real_estate', 'Kogarah, Allawah, Connells Point, Penshurst - St George, South Sydney', $json$
{ "name": "Belle Property St George", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Kogarah", "location_hq_country": "Australia", "description": "Belle Property franchise operating four offices across Sydney's St George region, originally founded in 1973 as Professionals Montgomery Group before rebranding to Belle Property in 2019.", "founded": 1973, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/st-george", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Kristina Lee", "member_position_title": "Principal" }, { "member_full_name": "Mark Somboli", "member_position_title": "Principal" }, { "member_full_name": "Jason Nightingale", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0057', 'real_estate', 'Hurstville, St George, South Sydney', $json$
{ "name": "Century 21 Specialist Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Hurstville", "location_hq_country": "Australia", "description": "Century 21 franchise office covering Hurstville, Allawah, Bexley and Kogarah across residential and commercial real estate.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": "https://hurstville.century21.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0058', 'real_estate', 'Bankstown, Canterbury-Bankstown, Sydney', $json$
{ "name": "Elders Real Estate Bankstown", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Bankstown", "location_hq_country": "Australia", "description": "One of the longest-established real estate agencies in the Canterbury-Bankstown area, operating under the Elders brand since 1971.", "founded": 1971, "type": "Privately Held (Elders franchise)", "websites_main": "https://bankstown.eldersrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0059', 'real_estate', 'Bankstown, Canterbury-Bankstown, Sydney', $json$
{ "name": "Hockingstuart Bankstown", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Bankstown", "location_hq_country": "Australia", "description": "Hockingstuart franchise office servicing Bankstown and the Canterbury-Bankstown property market across sales and property management.", "founded": null, "type": "Privately Held (Hockingstuart franchise)", "websites_main": "https://hockingstuart.com.au/bankstown", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0060', 'real_estate', 'Strathfield, Canterbury-Bankstown / Inner West, Sydney', $json$
{ "name": "Strathfield Partners", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Strathfield", "location_hq_country": "Australia", "description": "Independent real estate agency based in Strathfield, one of the larger listing agencies in the Canterbury-Bankstown region.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0061', 'real_estate', 'Bankstown, Campsie, Canterbury-Bankstown, Sydney', $json$
{ "name": "Ronis Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Bankstown", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Bankstown, Campsie and surrounding Canterbury-Bankstown suburbs across sales and property management.", "founded": null, "type": "Privately Held", "websites_main": "https://www.ronisrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0062', 'real_estate', 'Bankstown, Canterbury-Bankstown, Sydney', $json$
{ "name": "L H Brown & Co", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Bankstown", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Bankstown and the Canterbury-Bankstown region.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0063', 'real_estate', 'Dee Why, Mona Vale, Frenchs Forest - Northern Beaches, Sydney', $json$
{ "name": "The North Agency", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dee Why", "location_hq_country": "Australia", "description": "Independent real estate agency with offices in Dee Why, Mona Vale and Frenchs Forest, servicing over 30 suburbs across Sydney's Northern Beaches.", "founded": null, "type": "Privately Held", "websites_main": "https://thenorthagency.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Chris Aldren", "member_position_title": "Founding Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0064', 'real_estate', 'Manly to Palm Beach - Northern Beaches, Sydney', $json$
{ "name": "Clarke & Humel", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Manly", "location_hq_country": "Australia", "description": "Real estate agency specialising in prestige property across Sydney's Northern Beaches from Manly to Palm Beach.", "founded": null, "type": "Privately Held", "websites_main": "https://www.clarkeandhumel.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0065', 'real_estate', 'Manly, Northern Beaches, Sydney', $json$
{ "name": "Bergelin Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Manly", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Manly and Sydney's Northern Beaches.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0066', 'real_estate', 'Dee Why, Northern Beaches, Sydney', $json$
{ "name": "Upstate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dee Why", "location_hq_country": "Australia", "description": "Independent real estate agency based in Dee Why servicing Sydney's Northern Beaches.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0067', 'real_estate', 'Manly, Dee Why, Mona Vale, Terrey Hills, Avalon - Northern Beaches, Sydney', $json$
{ "name": "Belle Property Northern Beaches", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Manly", "location_hq_country": "Australia", "description": "Belle Property's founding franchised office and multi-office alliance across Manly, Dee Why, Mona Vale, Terrey Hills and Avalon, servicing Sydney's Northern Beaches.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/manly-nsw", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Brendan Pomponio", "member_position_title": "Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0068', 'real_estate', 'Campbelltown, Camden, Ingleburn, Narellan - Macarthur region, South West Sydney', $json$
{ "name": "Ray White Macarthur Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Campbelltown", "location_hq_country": "Australia", "description": "Ray White franchise group established in 2006, now the leading real estate agent for the Macarthur region with offices in Campbelltown, Camden, Ingleburn and Narellan.", "founded": 2006, "type": "Privately Held (Ray White franchise)", "websites_main": "https://rwmg.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0069', 'real_estate', 'Camden, Gregory Hills, Campbelltown, Narellan - Macarthur region, South West Sydney', $json$
{ "name": "Stone Real Estate Macarthur", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Camden", "location_hq_country": "Australia", "description": "Stone Real Estate franchise servicing the Macarthur region, grown since 2019 from a single Camden office to locations in Gregory Hills, Campbelltown and Narellan.", "founded": 2019, "type": "Privately Held (Stone Real Estate franchise)", "websites_main": "https://www.stonerealestate.com.au/stone-macarthur", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0070', 'real_estate', 'Campbelltown, Macarthur region, South West Sydney', $json$
{ "name": "Raine & Horne Commercial Macarthur", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Campbelltown", "location_hq_country": "Australia", "description": "Commercial real estate specialist established in 2000, rebranded from Raine & Horne Commercial Campbelltown in 2014, servicing Campbelltown, Camden, Liverpool, Wollondilly, Wingecarribee and Goulburn Mulwaree.", "founded": 2000, "type": "Privately Held (Raine & Horne franchise)", "websites_main": "https://www.rhcommercial.com.au/macarthur", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Daniel Krobot", "member_position_title": "Director" } ], "specialities": ["Commercial Real Estate"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0071', 'real_estate', 'Campbelltown, Macarthur region, South West Sydney', $json$
{ "name": "Macarthur Property Specialists", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Campbelltown", "location_hq_country": "Australia", "description": "Independent real estate agency servicing the Campbelltown and Macarthur region of South West Sydney.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0072', 'real_estate', 'Campbelltown, Macarthur region, South West Sydney', $json$
{ "name": "One Agency Campbelltown - C&P Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Campbelltown", "location_hq_country": "Australia", "description": "One Agency franchise office servicing Campbelltown and the Macarthur region under the subscription-based One Agency model.", "founded": null, "type": "Privately Held (One Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0073', 'real_estate', 'Windsor, Richmond, Pitt Town, Wisemans Ferry - Hawkesbury, Greater Sydney', $json$
{ "name": "Ray White Windsor & Richmond", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Windsor", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Windsor, Richmond, Pitt Town and Wisemans Ferry in Sydney's Hawkesbury region, with over a decade in operation.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitewrpt.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0074', 'real_estate', 'Richmond, Hawkesbury, Greater Sydney', $json$
{ "name": "Vibe Property Australia", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Richmond", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Richmond and the Hawkesbury region, offering sales, property management and rentals.", "founded": null, "type": "Privately Held", "websites_main": "https://vibeproperty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0075', 'real_estate', 'Windsor, Kurmond - Hawkesbury, Greater Sydney', $json$
{ "name": "Stone Real Estate Hawkesbury", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Windsor", "location_hq_country": "Australia", "description": "Stone Real Estate franchise operating offices in Windsor and Kurmond, servicing Sydney's Hawkesbury region across sales and property management.", "founded": null, "type": "Privately Held (Stone Real Estate franchise)", "websites_main": "https://www.stonerealestate.com.au/stone-hawkesbury", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Adam Buchert", "member_position_title": "Operations Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0076', 'real_estate', 'Windsor, Hawkesbury, Greater Sydney', $json$
{ "name": "Rachael Goldsworthy Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Windsor", "location_hq_country": "Australia", "description": "Boutique independent real estate agency based in Windsor, specialising in sales, rentals and strata services across the Hawkesbury region.", "founded": null, "type": "Privately Held", "websites_main": "https://rachaelgoldsworthy.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Rachael Goldsworthy", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Strata Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0077', 'real_estate', 'Richmond, Hawkesbury, Greater Sydney', $json$
{ "name": "Bennett Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Richmond", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Richmond and the Hawkesbury region across residential sales.", "founded": null, "type": "Privately Held", "websites_main": "https://www.bennettproperty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0078', 'real_estate', 'Windsor, Richmond, Hawkesbury, Greater Sydney', $json$
{ "name": "First National Real Estate Connect", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Windsor", "location_hq_country": "Australia", "description": "First National franchise office servicing Windsor, Richmond and surrounding Hawkesbury suburbs across sales, rentals and property management.", "founded": null, "type": "Privately Held (First National franchise)", "websites_main": "https://www.firstnationalconnect.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0079', 'real_estate', 'Rouse Hill, Box Hill, Kellyville - Hills District, Sydney', $json$
{ "name": "Meridien Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Rouse Hill", "location_hq_country": "Australia", "description": "Boutique independent real estate agency servicing Sydney's Hills District since 2002, covering Rouse Hill, Box Hill, Kellyville, Oakville, Tallawong and Beaumont Hills.", "founded": 2002, "type": "Privately Held", "websites_main": "https://meridienrealty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0080', 'real_estate', 'Castle Hill, Kellyville, Bella Vista, Glenhaven - Hills District, Sydney', $json$
{ "name": "Merc Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Castle Hill", "location_hq_country": "Australia", "description": "Award-winning independent real estate agency based in Castle Hill, offering sales and property management across the Hills District including Kellyville, Bella Vista and Glenhaven.", "founded": null, "type": "Privately Held", "websites_main": "https://www.mercrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0081', 'real_estate', 'Pymble, Upper North Shore, Sydney', $json$
{ "name": "One Agency Property Experts - Pymble", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Pymble", "location_hq_country": "Australia", "description": "One Agency franchise office servicing Sydney's Upper North Shore including Gordon, North Turramurra, Pymble, South Turramurra, Turramurra, Warrawee and West Pymble.", "founded": null, "type": "Privately Held (One Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Levent Ince", "member_position_title": "Founder & Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0082', 'real_estate', 'Ryde, Sydney', $json$
{ "name": "Belle Property Ryde", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ryde", "location_hq_country": "Australia", "description": "Belle Property franchise office servicing Ryde and surrounding suburbs across residential sales and property management.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/ryde", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Simon Harrison", "member_position_title": "Principal" }, { "member_full_name": "James Bennett", "member_position_title": "Principal" }, { "member_full_name": "Ramsy Batshon", "member_position_title": "Principal" }, { "member_full_name": "Patrick Lang", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0083', 'real_estate', 'Pymble, St Ives - Upper North Shore, Sydney', $json$
{ "name": "Belle Property Upper North Shore (Pymble)", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Pymble", "location_hq_country": "Australia", "description": "Belle Property franchise office servicing Sydney's Upper North Shore including Pymble, West Pymble, St Ives and St Ives Chase.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/pymble", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Michael Doran", "member_position_title": "Principal" }, { "member_full_name": "Daniel Dennis", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0084', 'real_estate', 'Ryde / Northern Districts, Sydney', $json$
{ "name": "Ray White The Ryde Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ryde", "location_hq_country": "Australia", "description": "Ray White franchise group servicing Ryde and Sydney's Northern Districts across residential sales and property management.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitetherydegroup.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Nick Matulic", "member_position_title": "Director" }, { "member_full_name": "David Aktas", "member_position_title": "Director" }, { "member_full_name": "Kerry Jarvis", "member_position_title": "Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0085', 'real_estate', 'Epping, Sydney', $json$
{ "name": "Ray White Epping", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Epping", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Epping, offering residential sales and property management.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteepping.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Catherine Li", "member_position_title": "Principal" }, { "member_full_name": "Dennis Nutt", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0086', 'real_estate', 'Turramurra, Upper North Shore, Sydney', $json$
{ "name": "Century 21 Radar Properties", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Turramurra", "location_hq_country": "Australia", "description": "Century 21 franchise office specialising in Sydney's Upper North Shore, based in Turramurra.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Peter Brack", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0087', 'real_estate', 'Epping, Castle Hill - North West Sydney', $json$
{ "name": "Uniland Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Epping", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Epping and Castle Hill across residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0088', 'real_estate', 'Five Dock, Inner West, Sydney', $json$
{ "name": "Time Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Five Dock", "location_hq_country": "Australia", "description": "Independent real estate agency founded in 1979, servicing the Inner Western suburbs of Sydney including Abbotsford, Ashfield, Concord, Drummoyne, Five Dock, Haberfield and Strathfield.", "founded": 1979, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0089', 'real_estate', 'Drummoyne, Five Dock, Inner West, Sydney', $json$
{ "name": "Belle Property Drummoyne", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Drummoyne", "location_hq_country": "Australia", "description": "Belle Property franchise office servicing Sydney's Inner West including Five Dock, Drummoyne, Haberfield, Abbotsford, Russell Lea, Rodd Point, Chiswick, Wareemba and Canada Bay.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/drummoyne", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Melissa Strazzeri", "member_position_title": "Co-Principal" }, { "member_full_name": "Antonio Ariola", "member_position_title": "Co-Principal" } ], "specialities": ["Residential Sales", "Property Management", "Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0090', 'real_estate', 'Five Dock, Drummoyne, Inner West, Sydney', $json$
{ "name": "Raine & Horne Five Dock | Drummoyne", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Five Dock", "location_hq_country": "Australia", "description": "Raine & Horne franchise office servicing Five Dock, Drummoyne, Abbotsford, Russell Lea and Rodd Point across residential sales and property management.", "founded": null, "type": "Privately Held (Raine & Horne franchise)", "websites_main": "https://www.raineandhorne.com.au/fivedock", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0001', 'real_estate', 'Newcastle, Hunter Region, NSW', $json$
{ "name": "LOVE Property Group Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Newcastle", "location_hq_country": "Australia", "description": "Real estate agency operating across multiple offices in Newcastle, offering residential sales and property management with a 6-star customer service focus.", "founded": 2007, "type": "Privately Held", "websites_main": "https://www.loverealty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Bill Kington", "member_position_title": "Co-Founder" }, { "member_full_name": "Stephen Cromarty", "member_position_title": "Co-Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0002', 'real_estate', 'Newcastle, Hunter Region, NSW', $json$
{ "name": "Borrelli Quirk Newcastle Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Newcastle", "location_hq_country": "Australia", "description": "Family owned and independent real estate agency operating continuously since 1961, specialising in Newcastle's growing apartment market as well as general residential sales, leasing and property management.", "founded": 1961, "type": "Privately Held", "websites_main": "https://www.bqnre.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Bill Quirk", "member_position_title": "Co-Owner" }, { "member_full_name": "Joanne Quirk", "member_position_title": "Co-Owner" } ], "specialities": ["Residential Sales", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0003', 'real_estate', 'Charlestown, Cessnock, Hunter Valley, NSW', $json$
{ "name": "Belle Property Charlestown / Cessnock / Hunter Valley", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Charlestown", "location_hq_country": "Australia", "description": "Belle Property franchise operating three agencies across Charlestown, Cessnock and the Hunter Valley, offering residential sales and property management.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Anthony Di Nardo", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0004', 'real_estate', 'Newcastle, Hunter Region, NSW', $json$
{ "name": "Andriessen Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Newcastle", "location_hq_country": "Australia", "description": "Independently family-owned real estate agency in Newcastle, founded over 40 years ago.", "founded": null, "type": "Privately Held", "websites_main": "https://www.apnewcastle.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Fred Andriessen", "member_position_title": "Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0005', 'real_estate', 'Cardiff, Newcastle, Hunter Region, NSW', $json$
{ "name": "One Agency Sarkis Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Cardiff", "location_hq_country": "Australia", "description": "One Agency franchise office servicing Cameron Park, Cardiff, Edgeworth, Glendale and West Wallsend in the Newcastle area.", "founded": null, "type": "Privately Held (One Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Nick Sarkis", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0006', 'real_estate', 'Wollongong, Illawarra, NSW', $json$
{ "name": "Ray White Wollongong", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wollongong", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Wollongong and the Illawarra region across residential sales, commercial opportunities and property investment.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitewollongong.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Fady Saad", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Property Investment"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0007', 'real_estate', 'Wollongong, Illawarra, NSW', $json$
{ "name": "Belle Property Illawarra", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wollongong", "location_hq_country": "Australia", "description": "Belle Property franchise founded in 2011, specialising in residential and commercial property sales, management and leasing throughout Wollongong; recognised as Belle Property's No. 2 office in Australia.", "founded": 2011, "type": "Privately Held (Belle Property franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Nicole Kay", "member_position_title": "Co-Principal" }, { "member_full_name": "Darren Kay", "member_position_title": "Co-Principal" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0008', 'real_estate', 'Wollongong, Illawarra, NSW', $json$
{ "name": "Elders Real Estate Wollongong", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wollongong", "location_hq_country": "Australia", "description": "Elders franchise office established in 2000, specialising in listing, selling and property management of residential, industrial, commercial and development properties in the Illawarra area.", "founded": 2000, "type": "Privately Held (Elders franchise)", "websites_main": "https://wollongong.eldersrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Lou Niceski", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0009', 'real_estate', 'Wollongong, Illawarra, NSW', $json$
{ "name": "MMJ Real Estate Wollongong", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wollongong", "location_hq_country": "Australia", "description": "Full agency service provider in Wollongong CBD for over 60 years, offering sales, leasing, management, valuation, project marketing and town planning.", "founded": null, "type": "Privately Held", "websites_main": "https://www.mmj.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate", "Property Management", "Project Marketing", "Town Planning"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0010', 'real_estate', 'Wollongong, Illawarra, NSW', $json$
{ "name": "Fitzgerald Hines", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wollongong", "location_hq_country": "Australia", "description": "Independent real estate agency connecting people to place across the Illawarra for over 40 years, founded as Peter Fitzgerald Real Estate in the 1980s.", "founded": null, "type": "Privately Held", "websites_main": "https://www.fitzgeraldhines.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0001', 'real_estate', 'Brisbane, Queensland', $json$
{ "name": "Place Estate Agents", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Residential real estate agency established in 2002 with a focus on sales and rentals, operating a Shared Services business model and dominating the Brisbane market.", "founded": 2002, "type": "Privately Held", "websites_main": "https://www.eplace.com.au", "websites_linkedin": "https://au.linkedin.com/company/place-estate-agents", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Damian Hackett", "member_position_title": "Chief Executive Officer" }, { "member_full_name": "Sarah Hackett", "member_position_title": "Managing Director & Principal, Place New Farm" } ], "specialities": ["Residential Sales", "Residential Rentals", "Property Projects", "Off The Plan Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0002', 'real_estate', 'Queensland-wide, HQ Brisbane', $json$
{ "name": "Queensland Sotheby's International Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Luxury real estate network of four lifestyle-positioned offices across Queensland, operating under the global Sotheby's International Realty brand.", "founded": null, "type": "Privately Held (Sotheby's International Realty affiliate)", "websites_main": "https://queenslandsothebysrealty.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Paul Arthur", "member_position_title": "Owner & Chief Executive Officer" } ], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0003', 'real_estate', 'Stafford, Brisbane, Queensland (national network)', $json$
{ "name": "Coronis", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Stafford", "location_hq_country": "Australia", "description": "One of Australia's largest sales and property management businesses, with approximately 15,000 properties under management and a network spanning Australia; began as a single agency in Stafford, north Brisbane.", "founded": null, "type": "Privately Held", "websites_main": "https://www.coronis.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Andrew Coronis", "member_position_title": "Chairman & Chief Executive Officer" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0004', 'real_estate', 'Inner Brisbane, Queensland', $json$
{ "name": "Hutton & Hutton Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Boutique inner-Brisbane real estate agency specialising in apartment and residential sales, with a strong presence across New Farm and surrounding suburbs.", "founded": null, "type": "Privately Held", "websites_main": "https://huttonandhutton.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Peter Hutton", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0005', 'real_estate', 'Western Suburbs, Brisbane, Queensland', $json$
{ "name": "Brisbane West Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Brisbane's Western Suburbs across residential, acreage, townhouse and unit property sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": "https://www.linkedin.com/company/brisbanewestrealestate", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Franzwa Van Vuuren", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0006', 'real_estate', 'Indooroopilly, Brisbane, Queensland', $json$
{ "name": "Brisbane Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Indooroopilly", "location_hq_country": "Australia", "description": "Real estate agency established at the turn of the century servicing every suburb in Brisbane, from single-bedroom units to prestige acreage and riverfront homes.", "founded": null, "type": "Privately Held", "websites_main": "https://brisbanerealestate.com.au", "websites_linkedin": "https://au.linkedin.com/company/brisbane-real-estate", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0007', 'real_estate', 'National & international network, HQ Brisbane', $json$
{ "name": "Ray White Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Australasia's largest real estate group, established in 1902 in Crows Nest, Queensland, offering residential, commercial and rural property, hotels, marine, property management and property funds investment across Australia, New Zealand, Indonesia, India, Malaysia, PNG, China, the Middle East and the USA.", "founded": 1902, "type": "Privately Held (family owned)", "websites_main": "https://www.raywhite.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Brian White", "member_position_title": "Co-Chairman" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Rural Property", "Property Management", "Property Funds Investment"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0008', 'real_estate', 'North Brisbane, Redcliffe Peninsula, Greater Springfield - South East Queensland', $json$
{ "name": "Ray White One Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Queensland's largest Ray White group, with a network of offices strategically located across North Brisbane, the Redcliffe Peninsula and Greater Springfield.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteonegroup.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0009', 'real_estate', 'Western & Northern Suburbs, Brisbane, Queensland', $json$
{ "name": "Arthur Conias Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": 17, "location_hq_city": "Kenmore", "location_hq_country": "Australia", "description": "Family-run real estate company and the longest-serving agency in Brisbane's Western and Northern suburbs, established in 1972, with offices in Toowong and Ashgrove.", "founded": 1972, "type": "Privately Held", "websites_main": "https://www.arthurconias.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Arthur Conias", "member_position_title": "Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0010', 'real_estate', 'South Brisbane, Queensland', $json$
{ "name": "Belle Property South Brisbane", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "South Brisbane", "location_hq_country": "Australia", "description": "Belle Property franchise office servicing Brisbane's inner city and Southern regions, the second Belle Property office to open in Brisbane.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Bettina Jude", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0011', 'real_estate', 'Brisbane North, Queensland', $json$
{ "name": "Belle Property Commercial Brisbane North", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Belle Property Commercial franchise office servicing Brisbane North across commercial sales, leasing and asset management.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.bellecommercial.com/offices/brisbane-north", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Brocke Hambrecht", "member_position_title": "Principal" }, { "member_full_name": "Shelley Hambrecht", "member_position_title": "Principal" } ], "specialities": ["Commercial Real Estate", "Leasing", "Asset Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0012', 'real_estate', 'New Farm, Bulimba, East Brisbane, Clayfield, Toowong, Spring Hill - Brisbane, Queensland', $json$
{ "name": "Ray White Collective", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "New Farm", "location_hq_country": "Australia", "description": "Ray White franchise collective spanning New Farm, Bulimba, East Brisbane, Clayfield, Toowong and Spring Hill, recognised as Ray White's number one international business; Ray White New Farm was founded in 2005.", "founded": 2005, "type": "Privately Held (Ray White franchise)", "websites_main": "https://rwnf.com.au", "websites_linkedin": "https://au.linkedin.com/company/ray-white-new-farm", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Haesley Cush", "member_position_title": "Chief Executive Officer" }, { "member_full_name": "Matt Lancashire", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Luxury Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0013', 'real_estate', 'Queensland-wide (rural & agribusiness), HQ Brisbane', $json$
{ "name": "Ray White Rural Queensland", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Ray White franchise established in 1994 specialising in the sale of agribusiness, rural and lifestyle properties across Queensland, with an auction clearance rate of 85-95%.", "founded": 1994, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteruralbrisbane.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Bruce Douglas", "member_position_title": "Principal" }, { "member_full_name": "Jez McNamara", "member_position_title": "Principal" } ], "specialities": ["Rural & Agribusiness Real Estate", "Lifestyle Property"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0014', 'real_estate', 'Brisbane to Gold Coast, Queensland', $json$
{ "name": "Golden Ocean Realty", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Real estate agency providing residential property sales, property management and management rights services from Brisbane to the Gold Coast.", "founded": null, "type": "Privately Held", "websites_main": "https://www.goldenoceanrealty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Management Rights"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0015', 'real_estate', 'Brisbane, Queensland', $json$
{ "name": "NGU Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Real estate agency network operating in the greater Brisbane region across residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": "https://ngurealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0001', 'real_estate', 'Melbourne CBD, Carlton, Fitzroy - Victoria', $json$
{ "name": "Belle Property Melbourne", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Belle Property franchise office delivering boutique, premium real estate services across Melbourne CBD, Carlton, Carlton North, Fitzroy, Fitzroy North, West Melbourne, North Melbourne, Parkville and Princes Hill.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/melbourne", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Scott McElroy", "member_position_title": "Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0002', 'real_estate', 'Melbourne, Victoria', $json$
{ "name": "MRE (Melbourne Real Estate)", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Real estate agency with over 30 years of experience in Melbourne, offering residential sales, rentals and property management with a focus on new developments and project marketing.", "founded": null, "type": "Privately Held", "websites_main": "https://mre.today", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Stephen Fitzsimon", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management", "Project Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0003', 'real_estate', 'Melbourne-wide network, Victoria', $json$
{ "name": "Jellis Craig", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "One of Melbourne's leading real estate groups, established in 1991, with a network of offices across Melbourne's most sought-after suburbs and reach into interstate and international markets.", "founded": 1991, "type": "Privately Held", "websites_main": null, "websites_linkedin": "https://au.linkedin.com/company/jellis-craig", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Premium Property Sales", "Property Management", "Auctioneering"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0004', 'real_estate', 'Melbourne prestige suburbs (Boroondara etc.), Victoria', $json$
{ "name": "Kay & Burton", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Prestige Melbourne real estate agency specialising in premium residential sales across the city's most exclusive suburbs.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0005', 'real_estate', 'Melbourne prestige suburbs (Boroondara, Bayside etc.), Victoria', $json$
{ "name": "Marshall White", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Prestige Melbourne real estate agency with offices across Boroondara and Bayside, specialising in premium residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0006', 'real_estate', 'Melbourne inner north (Carlton, Kew, Docklands etc.), Victoria', $json$
{ "name": "Nelson Alexander", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency with offices across Carlton, Kew and Docklands, offering residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0007', 'real_estate', 'Melbourne (Camberwell, Croydon etc.), Victoria', $json$
{ "name": "Woodards", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency network with offices including Camberwell and Croydon, offering residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0008', 'real_estate', 'Melbourne Bayside (Hampton, Glen Eira etc.), Victoria', $json$
{ "name": "Buxton", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency network servicing the Bayside region including Hampton East and Glen Eira across residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0009', 'real_estate', 'Melbourne-wide network, Victoria', $json$
{ "name": "Barry Plant", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne-based real estate franchise network offering residential sales and property management across metropolitan and outer suburbs.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0010', 'real_estate', 'Melbourne (Glen Waverley etc.), Victoria', $json$
{ "name": "Biggin & Scott", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency network with offices including Glen Waverley, offering residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0001', 'real_estate', 'ACT & NSW South Coast (Canberra region)', $json$
{ "name": "Blackshaw Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "Industry-leading and award-winning sales and property management agency operating across the ACT, surrounding region and NSW south coast since 1988; five-time National Agency of the Year winner.", "founded": 1988, "type": "Privately Held", "websites_main": "https://www.blackshaw.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Peter Blackshaw", "member_position_title": "Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0002', 'real_estate', 'ACT & surrounding region', $json$
{ "name": "Independent Property Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "One of the largest and most trusted real estate agencies in the ACT, established in Canberra in 1958, offering a full range of property services including new developments and land packages.", "founded": 1958, "type": "Privately Held", "websites_main": "https://independent.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "New Developments"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0003', 'real_estate', 'Canberra & Queanbeyan, ACT', $json$
{ "name": "Belle Property Canberra", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "Belle Property franchise operating across Canberra and Queanbeyan since 2016, offering sales and property management with a values-driven, community-focused approach.", "founded": 2016, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/canberra", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Richard Davies", "member_position_title": "Co-Principal" }, { "member_full_name": "Dan McAlpine", "member_position_title": "Co-Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0004', 'real_estate', 'Conder, Tuggeranong, Belconnen - Canberra, ACT', $json$
{ "name": "McIntyre Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "Founded in 2007 as a small boutique agency, now the largest independently-owned full-service agency offering property management and sales in Canberra, with offices in Conder, Tuggeranong and Belconnen.", "founded": 2007, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Col McIntyre", "member_position_title": "Principal" }, { "member_full_name": "Jo Matters", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0005', 'real_estate', 'Canberra, ACT', $json$
{ "name": "The Property Collective", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "Real estate agency founded in 2020 offering a modern, collective approach to managing, selling and buying property in Canberra, including service guarantees such as covering rent for non-paying tenants.", "founded": 2020, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Will Honey", "member_position_title": "Chief Executive Officer & Co-Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0091', 'real_estate', 'Cronulla, Sutherland Shire, Sydney', $json$
{ "name": "Gibson Partners Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Cronulla", "location_hq_country": "Australia", "description": "Independent real estate agency in Cronulla and the Sutherland Shire, founded in 1999, offering residential sales and property management.", "founded": 1999, "type": "Privately Held", "websites_main": "https://www.gibsonpartners.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Ivan Lampret", "member_position_title": "Licensee & Managing Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0092', 'real_estate', 'Caringbah, Sutherland Shire, Sydney', $json$
{ "name": "Newton Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Caringbah", "location_hq_country": "Australia", "description": "Real estate agency founded in 2001, grown to become one of the most respected agencies in the Sutherland Shire property industry.", "founded": 2001, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0093', 'real_estate', 'Miranda, Sutherland Shire, Sydney', $json$
{ "name": "Laing+Simmons Miranda", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Miranda", "location_hq_country": "Australia", "description": "Laing+Simmons franchise office established in 2004, a leading boutique real estate agency in the Sutherland Shire.", "founded": 2004, "type": "Privately Held (Laing+Simmons franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0094', 'real_estate', 'Sutherland Shire, Sydney', $json$
{ "name": "Payne Pacific Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Cronulla", "location_hq_country": "Australia", "description": "Second-generation family real estate business operating in the Sutherland Shire since 1992, spanning residential, commercial and industrial sales, management and leasing plus project sales.", "founded": 1992, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate", "Industrial Real Estate", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0095', 'real_estate', 'Cronulla, Sutherland Shire, Sydney', $json$
{ "name": "Chris Burke & Co", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Cronulla", "location_hq_country": "Australia", "description": "Independent real estate agency in Cronulla specialising in residential sales across the Sutherland Shire.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "David Kennedy", "member_position_title": "Director" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0096', 'real_estate', 'Blacktown, Western Sydney', $json$
{ "name": "Elders Real Estate Blacktown", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Blacktown", "location_hq_country": "Australia", "description": "Elders franchise office serving the Blacktown community for over 16 years across residential sales and property management.", "founded": null, "type": "Privately Held (Elders franchise)", "websites_main": "https://blacktown.eldersrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Rufina Djo", "member_position_title": "Principal" }, { "member_full_name": "Adam Silva", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0097', 'real_estate', 'Blacktown, Western Sydney', $json$
{ "name": "LJ Hooker Blacktown", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Blacktown", "location_hq_country": "Australia", "description": "LJ Hooker franchise office and a prominent, successful business based in Blacktown for thirty years.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": "https://blacktown.ljhooker.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0098', 'real_estate', 'Blacktown, Western Sydney', $json$
{ "name": "RealHelp Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Blacktown", "location_hq_country": "Australia", "description": "Real estate agency providing property management, sales and rental services across Blacktown and Western Sydney, with a low-commission model for landlords.", "founded": null, "type": "Privately Held", "websites_main": "https://www.realhelp.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0099', 'real_estate', 'Seven Hills, Western Sydney', $json$
{ "name": "Century 21 The Rana Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Seven Hills", "location_hq_country": "Australia", "description": "Century 21 franchise office covering Seven Hills, Blacktown, Toongabbie and Pendle Hill across residential real estate.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": "https://theranagroup.century21.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0100', 'real_estate', 'Blacktown, Western Sydney', $json$
{ "name": "Laing+Simmons Blacktown", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Blacktown", "location_hq_country": "Australia", "description": "Laing+Simmons franchise office servicing Blacktown across residential sales and property management.", "founded": null, "type": "Privately Held (Laing+Simmons franchise)", "websites_main": "https://lsre.com.au/blacktown", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Andrew Ienna", "member_position_title": "Business Owner" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0101', 'real_estate', 'Sutherland Shire, Sydney', $json$
{ "name": "Greg Gilbert Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Sutherland", "location_hq_country": "Australia", "description": "Independent real estate agency servicing the Sutherland Shire across residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0102', 'real_estate', 'Miranda, Cronulla, Sutherland - Southern Sydney', $json$
{ "name": "Pulse Property Agents", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Miranda", "location_hq_country": "Australia", "description": "Real estate agency specialising in property sales, management and rentals across Miranda, Cronulla and Sutherland in Southern Sydney.", "founded": null, "type": "Privately Held", "websites_main": "https://www.pulseproperty.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0011', 'real_estate', 'Port Macquarie, Mid North Coast, NSW', $json$
{ "name": "Belle Property Port Macquarie", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Port Macquarie", "location_hq_country": "Australia", "description": "Belle Property franchise office established in 2017, a boutique agency specialising in residential property sales across Port Macquarie and surrounding suburbs.", "founded": 2017, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/port-macquarie", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Sue Jogever", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0012', 'real_estate', 'Port Macquarie, Mid North Coast, NSW', $json$
{ "name": "Percival Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Port Macquarie", "location_hq_country": "Australia", "description": "Independent real estate and property management agency in Port Macquarie, recognised as Port Macquarie Sales Agency of the Year in nine of the last ten years.", "founded": null, "type": "Privately Held", "websites_main": "https://www.percival.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0013', 'real_estate', 'Port Macquarie, Mid North Coast, NSW', $json$
{ "name": "Platinum & Co Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Port Macquarie", "location_hq_country": "Australia", "description": "Independent real estate agency in Port Macquarie offering residential sales with a close-knit local team.", "founded": null, "type": "Privately Held", "websites_main": "https://platinumpmq.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Corrine Cunningham", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0014', 'real_estate', 'Port Macquarie, Mid North Coast, NSW', $json$
{ "name": "Wiseberry Port Macquarie", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Port Macquarie", "location_hq_country": "Australia", "description": "Wiseberry franchise office in Port Macquarie handling sales, rentals, holiday accommodation, auctions and property management.", "founded": null, "type": "Privately Held (Wiseberry franchise)", "websites_main": "https://wiseberry.com.au/portmacquarie", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Holiday Rentals", "Auctions"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0015', 'real_estate', 'Port Macquarie, Mid North Coast, NSW', $json$
{ "name": "McGrath Port Macquarie", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Port Macquarie", "location_hq_country": "Australia", "description": "McGrath franchise office servicing Port Macquarie and the Mid North Coast across residential sales.", "founded": null, "type": "Privately Held (McGrath franchise)", "websites_main": "https://www.mcgrath.com.au/offices/port-macquarie-a0v5g0000009LEgAAM", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Todd Bates", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0016', 'real_estate', 'Tamworth, New England, NSW', $json$
{ "name": "McGrath Knight Frank Tamworth", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Tamworth", "location_hq_country": "Australia", "description": "Real estate agency formerly known as Burke & Smyth Real Estate, rebranded as McGrath Knight Frank Tamworth, offering residential and commercial sales, leasing, asset management, project marketing and finance.", "founded": null, "type": "Privately Held", "websites_main": "https://www.mcgrath.com.au/offices/tamworth-a0vRE00000ACoDnYAL", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Gavin Knee", "member_position_title": "Principal & Licensee" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Leasing", "Asset Management", "Project Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0017', 'real_estate', 'Dubbo, Central West, NSW', $json$
{ "name": "Elders Real Estate Dubbo", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dubbo", "location_hq_country": "Australia", "description": "Elders franchise office operating in the Dubbo area for over 50 years, covering Dubbo, Brocklehurst, Eumungerie, Geurie, Narromine and Wongarbon.", "founded": null, "type": "Privately Held (Elders franchise)", "websites_main": "https://dubbo.eldersrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0018', 'real_estate', 'Dubbo, Central West, NSW', $json$
{ "name": "Raine & Horne Dubbo", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dubbo", "location_hq_country": "Australia", "description": "Raine & Horne franchise office and the top-selling real estate agency in Dubbo by property sales volume.", "founded": null, "type": "Privately Held (Raine & Horne franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0019', 'real_estate', 'Dubbo, Central West, NSW', $json$
{ "name": "Bob Berry Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dubbo", "location_hq_country": "Australia", "description": "Independent real estate agency in Dubbo, one of the region's top-selling agencies by property sales volume.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0020', 'real_estate', 'Tamworth, New England, NSW', $json$
{ "name": "Professionals Tamworth", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Tamworth", "location_hq_country": "Australia", "description": "Professionals franchise office servicing Tamworth across residential sales and property management.", "founded": null, "type": "Privately Held (Professionals franchise)", "websites_main": "https://www.professionalstamworth.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0016', 'real_estate', 'Bulimba, Balmoral, Hawthorne and inner suburbs - Brisbane, Queensland', $json$
{ "name": "Atlas", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Lifestyle-inspired real estate agency covering Brisbane's inner suburbs including Bulimba, Balmoral, Hawthorne, Morningside, Coorparoo, New Farm and Fortitude Valley.", "founded": null, "type": "Privately Held", "websites_main": "https://www.atlas.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0017', 'real_estate', 'Ipswich, Wynnum Manly, Chermside, Redlands, Logan West - Greater Brisbane, Queensland', $json$
{ "name": "Johnson Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ipswich", "location_hq_country": "Australia", "description": "Real estate agency network with offices across Ipswich, Wynnum Manly, Chermside, Redlands, Logan West and Northern Gold Coast, offering sales, property management, commercial and finance services.", "founded": null, "type": "Privately Held", "websites_main": "https://www.johnsonre.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management", "Commercial Real Estate", "Finance"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0018', 'real_estate', 'Brisbane, Queensland', $json$
{ "name": "Absolute Estate Agents", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Brisbane across buying, selling and investment property services.", "founded": null, "type": "Privately Held", "websites_main": "https://www.absoluteestateagents.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Investment"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0019', 'real_estate', 'Sunnybank Hills, Mount Gravatt - Brisbane, Queensland', $json$
{ "name": "LJ Hooker Property Partners", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Sunnybank Hills", "location_hq_country": "Australia", "description": "LJ Hooker franchise office servicing Sunnybank Hills and Mount Gravatt across residential sales and property management.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0020', 'real_estate', 'Ascot, Hamilton, Clayfield, Hendra, Wooloowin, Albion - Brisbane, Queensland', $json$
{ "name": "Ray White Ascot", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ascot", "location_hq_country": "Australia", "description": "Ray White franchise office and real estate specialist in Brisbane's inner north-east since 2003, recognised among the top 1% of Ray White Group businesses.", "founded": 2003, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteascot.com.au", "websites_linkedin": "https://au.linkedin.com/company/raywhiteascot", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Damon Warat", "member_position_title": "Principal" }, { "member_full_name": "Alexander Shean", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0021', 'real_estate', 'Camp Hill, Carina, Carina Heights, Carindale - Brisbane, Queensland', $json$
{ "name": "Ray White Carina", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Carina", "location_hq_country": "Australia", "description": "Ray White franchise office established in the area since 1983, selling homes predominantly in Camp Hill, Carina, Carina Heights and Carindale.", "founded": 1983, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitecarina.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Andrew McSweeny", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0022', 'real_estate', 'Toowong, Chapel Hill, Taringa, Indooroopilly - Brisbane inner-west, Queensland', $json$
{ "name": "Ray White Toowong | Chapel Hill", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Toowong", "location_hq_country": "Australia", "description": "Ray White franchise office combining deep local expertise across Brisbane's inner-west and western corridor, part of the Ray White Collective network of over 100 real estate professionals.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitetoowong.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0023', 'real_estate', 'Sherwood, Graceville, Centenary - Brisbane, Queensland', $json$
{ "name": "Ray White Sherwood | Centenary", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Sherwood", "location_hq_country": "Australia", "description": "Ray White franchise office and one of Brisbane's most recommended real estate agencies, specialising in residential sales and property management in the Sherwood, Graceville and Centenary area.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitesherwood.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0024', 'real_estate', 'Wilston, Brisbane, Queensland', $json$
{ "name": "Ray White Wilston", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wilston", "location_hq_country": "Australia", "description": "Ray White franchise office established in 2004, recognised as one of the leading real estate businesses in the country.", "founded": 2004, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitewilston.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0025', 'real_estate', 'Redcliffe, Brisbane, Queensland', $json$
{ "name": "Ray White Redcliffe", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Redcliffe", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Redcliffe's real estate market across residential sales and property management.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteredcliffe.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0026', 'real_estate', 'Aspley, Northside Brisbane, Queensland', $json$
{ "name": "Ray White Aspley", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Aspley", "location_hq_country": "Australia", "description": "Ray White franchise office and a cornerstone of the Northside Brisbane real estate industry for over 25 years, part of the Ray White One Group of ten offices.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteaspley.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Paul Hodkinson", "member_position_title": "Founder" }, { "member_full_name": "Robert Green", "member_position_title": "Chief Executive Officer" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0027', 'real_estate', 'Paddington, Red Hill, Kelvin Grove, Ashgrove, The Gap - Brisbane, Queensland', $json$
{ "name": "Ray White Paddington", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Paddington", "location_hq_country": "Australia", "description": "Ray White franchise office franchised since 1985, one of the largest teams in the Ray White network, servicing Paddington, Red Hill, Kelvin Grove, Ashgrove and The Gap.", "founded": 1985, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitepaddington.com.au", "websites_linkedin": "https://au.linkedin.com/company/raywhitepaddington", "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "George Hadgelias", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management", "Auctioneering"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0028', 'real_estate', 'Coorparoo, Brisbane, Queensland', $json$
{ "name": "Ray White Coorparoo", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Coorparoo", "location_hq_country": "Australia", "description": "Ray White franchise office and a local real estate icon for the past 35 years, holding a leading position in both sales and property management services south of the river.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitecoorparoo.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0029', 'real_estate', 'Wynnum, Manly - Bayside Brisbane, Queensland', $json$
{ "name": "Ray White Wynnum / Manly", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wynnum", "location_hq_country": "Australia", "description": "Ray White franchise office and a top-10 performing office in the Bayside area since 1978, servicing residential, acreage and commercial property.", "founded": 1978, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitewynnummanly.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0030', 'real_estate', 'Bayside Brisbane, Redlands Coast, Queensland', $json$
{ "name": "RWC Bayside", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brisbane", "location_hq_country": "Australia", "description": "Ray White Commercial franchise office established in 1995, Bayside's premier commercial property agency delivering sales, leasing and property management across Brisbane's Bayside and the Redlands Coast.", "founded": 1995, "type": "Privately Held (Ray White Commercial franchise)", "websites_main": "https://raywhitecommercialbayside.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Commercial Real Estate", "Leasing", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0031', 'real_estate', 'Nundah, Brisbane, Queensland', $json$
{ "name": "Ray White Nundah", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Nundah", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Nundah in Queensland's Golden Employment Triangle, built on a legacy established by former principals Anthony and Andrea Clark.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitenundah.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Benson Spong", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0032', 'real_estate', 'Sandgate, Bracken Ridge - Northern Brisbane, Queensland', $json$
{ "name": "Ray White Sandgate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Sandgate", "location_hq_country": "Australia", "description": "Ray White franchise office servicing the 4017 postcode including Bracken Ridge, Sandgate, Shorncliffe, Deagon and Brighton in Northern Brisbane.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Roxanne Paterson", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0033', 'real_estate', 'Springfield, Greater Brisbane, Queensland', $json$
{ "name": "Ray White Springfield", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Springfield", "location_hq_country": "Australia", "description": "Ray White franchise office and the third office to open in the Ray White One Group's network, servicing Australia's largest master-planned suburb, Springfield.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitespringfield.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Phill Broom", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0034', 'real_estate', 'Annerley, Brisbane, Queensland', $json$
{ "name": "Ray White Annerley", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Annerley", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Annerley and surrounds across residential sales and property management.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteannerley.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0035', 'real_estate', 'Annerley, Yeronga - Brisbane, Queensland', $json$
{ "name": "LJ Hooker Annerley/Yeronga", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Annerley", "location_hq_country": "Australia", "description": "LJ Hooker franchise office servicing Annerley and Yeronga across residential sales and property management.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0036', 'real_estate', 'Chapel Hill, Kenmore, Indooroopilly, Taringa - Brisbane western corridor, Queensland', $json$
{ "name": "Ray White MetroWest", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Chapel Hill", "location_hq_country": "Australia", "description": "Ray White franchise office founded in 2013, servicing Brisbane's western corridor including Chapel Hill, Indooroopilly, Taringa, Kenmore, Fig Tree Pocket, Toowong and Brookfield.", "founded": 2013, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitemetrowestresidential.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Craig Sharp", "member_position_title": "Founder & Director" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0037', 'real_estate', 'Everton Park, North West Brisbane, Queensland', $json$
{ "name": "Ray White Everton Park", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Everton Park", "location_hq_country": "Australia", "description": "Ray White franchise office and a recent addition to the Ray White One Group network, servicing the North West corridor of Brisbane, building on an original Ray White Aspley presence spanning over 30 years.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteevertonpark.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Kelly Qualtrough", "member_position_title": "Principal" }, { "member_full_name": "Andrew King", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-BNE-0038', 'real_estate', 'Bulimba, East Brisbane, Balmoral, Cannon Hill, Hawthorne - Brisbane, Queensland', $json$
{ "name": "Ray White East Brisbane", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "East Brisbane", "location_hq_country": "Australia", "description": "Ray White franchise office delivering property sales in Bulimba and coveted inner east suburbs including Balmoral, Cannon Hill, Hawthorne, Morningside, East Brisbane, Norman Park and Kangaroo Point.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhiteeastbrisbane.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Scott Darwon", "member_position_title": "Principal" }, { "member_full_name": "Brandon Wortley", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0011', 'real_estate', 'Melbourne-wide network (Victoria & NSW), HQ South Melbourne', $json$
{ "name": "Hockingstuart", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "South Melbourne", "location_hq_country": "Australia", "description": "Landmark Victorian real estate brand established in 1985, merged with Belle Property in 2019 to form a combined network of over 39 Victorian offices and more than 120 offices nationally.", "founded": 1985, "type": "Privately Held", "websites_main": "https://hockingstuart.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Greg Hocking", "member_position_title": "Co-Founder" }, { "member_full_name": "Andrew Stuart", "member_position_title": "Co-Founder" } ], "specialities": ["Residential Sales", "Property Management", "Land & Projects", "Commercial Real Estate"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0012', 'real_estate', 'Melbourne (Caulfield / prestige suburbs), Victoria', $json$
{ "name": "Gary Peer & Associates", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency specialising in residential sales across the city's prestige suburbs.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0013', 'real_estate', 'Melbourne (Port Phillip / Elwood area), Victoria', $json$
{ "name": "Chisholm & Gamon", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency servicing the Port Phillip and bayside suburbs across residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0014', 'real_estate', 'Melbourne (Essendon / Western suburbs), Victoria', $json$
{ "name": "Brad Teal Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency servicing Essendon and the Western suburbs across residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0015', 'real_estate', 'Melbourne prestige suburbs (Toorak, Mornington Peninsula), Victoria', $json$
{ "name": "RT Edgar", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Prestige Melbourne real estate agency with a presence across Toorak and the Mornington Peninsula, specialising in premium residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0016', 'real_estate', 'Melbourne (Balwyn, Boroondara), Victoria', $json$
{ "name": "Fletchers", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency network with offices across Balwyn, Balwyn North and the Boroondara region, offering residential sales and property management.", "founded": null, "type": "Privately Held", "websites_main": "https://fletchers.net.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0017', 'real_estate', 'Melbourne (South Yarra / Malvern area), Victoria', $json$
{ "name": "Bennison Mackinnon", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency servicing South Yarra and Malvern across residential sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0018', 'real_estate', 'Melbourne, Victoria', $json$
{ "name": "Nicholas Lynch Rentals", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne property management agency specialising in residential rentals.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0019', 'real_estate', 'Melbourne, Victoria', $json$
{ "name": "Philip Webb", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency offering residential sales, rentals and property management.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0020', 'real_estate', 'Melbourne, Victoria', $json$
{ "name": "Castran Gilbert", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Melbourne", "location_hq_country": "Australia", "description": "Melbourne real estate agency specialising in residential sales across prestige inner suburbs.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0021', 'real_estate', 'Toorak, Victoria', $json$
{ "name": "The Agency Victoria", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Toorak", "location_hq_country": "Australia", "description": "The Agency franchise office servicing Victoria from its Toorak office.", "founded": null, "type": "Privately Held (The Agency franchise)", "websites_main": "https://theagency.com.au/office/6/victoria", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0022', 'real_estate', 'Brighton, Bayside, Melbourne, Victoria', $json$
{ "name": "Melbourne Sotheby's International Realty (Bayside)", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brighton", "location_hq_country": "Australia", "description": "Bayside Sotheby's International Realty office representing Brighton and the broader Bayside market under the global Sotheby's International Realty luxury brand.", "founded": null, "type": "Privately Held (Sotheby's International Realty affiliate)", "websites_main": "https://melbournesothebysrealty.com", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Andrew Campbell", "member_position_title": "Founder" }, { "member_full_name": "Victoria Gregory", "member_position_title": "Founder" } ], "specialities": ["Luxury Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0023', 'real_estate', 'Brighton, St Kilda, Bayside, Melbourne, Victoria', $json$
{ "name": "Belle Property Brighton / St Kilda", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brighton", "location_hq_country": "Australia", "description": "Belle Property franchise operating a combined Brighton and St Kilda office, one of the largest real estate teams in Melbourne's Bayside market.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": "https://www.belleproperty.com/brighton", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Sam Inan", "member_position_title": "Co-Director" }, { "member_full_name": "John Manning", "member_position_title": "Co-Director" } ], "specialities": ["Residential Sales", "Commercial Real Estate", "Leasing", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0024', 'real_estate', 'Brighton, Bayside, Melbourne, Victoria', $json$
{ "name": "McGrath Brighton", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Brighton", "location_hq_country": "Australia", "description": "McGrath franchise office and a top-selling agency in the Brighton and St Kilda area of Melbourne's Bayside.", "founded": null, "type": "Privately Held (McGrath franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0025', 'real_estate', 'South Yarra, Richmond, Melbourne, Victoria', $json$
{ "name": "Clements International", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "South Yarra", "location_hq_country": "Australia", "description": "Premium real estate agency servicing Melbourne's inner east including South Yarra and Richmond across residential sales and leasing.", "founded": null, "type": "Privately Held", "websites_main": "https://www.clementsinternational.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Robert Clements", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0026', 'real_estate', 'Werribee, Wyndham Vale, Manor Lakes - Western Melbourne, Victoria', $json$
{ "name": "McGrath Werribee", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Werribee", "location_hq_country": "Australia", "description": "McGrath franchise office servicing Werribee, Wyndham Vale and Manor Lakes across residential sales and property management.", "founded": null, "type": "Privately Held (McGrath franchise)", "websites_main": "https://www.mcgrath.com.au/offices/werribee-a0v5g000002CZ7BAAW", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Taney Jain", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0027', 'real_estate', 'Frankston, Mornington Peninsula, Victoria', $json$
{ "name": "O'Brien Real Estate Frankston", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Frankston", "location_hq_country": "Australia", "description": "O'Brien Real Estate franchise office and the top-selling agency in Frankston by property sales volume.", "founded": null, "type": "Privately Held (O'Brien Real Estate franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0028', 'real_estate', 'Frankston, Mornington Peninsula, Victoria', $json$
{ "name": "Ray White Frankston", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Frankston", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Frankston and the Mornington Peninsula across residential sales.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0029', 'real_estate', 'Werribee, Western Melbourne, Victoria', $json$
{ "name": "The Specialist Agency", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Werribee", "location_hq_country": "Australia", "description": "Property management agency founded by a former real estate sales agent in 2017, specialising in stress-free property management experiences across Melbourne and Werribee.", "founded": 2017, "type": "Privately Held", "websites_main": "https://specialistagency.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Ramit Parmar", "member_position_title": "Founder" } ], "specialities": ["Property Management", "Strata Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-MEL-0030', 'real_estate', 'Tarneit, Truganina, Wyndham Vale, Manor Lakes, Werribee, Point Cook - Western Melbourne, Victoria', $json$
{ "name": "Reddy G", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Tarneit", "location_hq_country": "Australia", "description": "Real estate agency servicing Melbourne's Western Suburbs including Tarneit, Truganina, Wyndham Vale, Manor Lakes, Werribee and Point Cook across residential and commercial property.", "founded": null, "type": "Privately Held", "websites_main": "https://reddyg.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0006', 'real_estate', 'Canberra, ACT', $json$
{ "name": "Real Estate Australia", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Canberra", "location_hq_country": "Australia", "description": "Real estate agency founded in 2001, one of the first in Canberra to launch a website, offering an instant online property estimate and tenant/owner online portals.", "founded": 2001, "type": "Privately Held", "websites_main": "https://realestateaustralia.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Peter Tolhurst", "member_position_title": "Founder & Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0007', 'real_estate', 'Dickson, Canberra, ACT', $json$
{ "name": "home.byHolly", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Dickson", "location_hq_country": "Australia", "description": "Boutique Canberra real estate agency based in Dickson, taking a creative, community-based approach to residential property sales.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Holly Komorowski", "member_position_title": "Founder" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0008', 'real_estate', 'Gungahlin, Braddon - Canberra, ACT', $json$
{ "name": "Carter + Co Agents", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Gungahlin", "location_hq_country": "Australia", "description": "Boutique real estate agency founded in 2019, servicing the broader ACT and Queanbeyan region across residential sales and property management.", "founded": 2019, "type": "Privately Held", "websites_main": "https://carterandcoagents.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "James Carter", "member_position_title": "Founder" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0009', 'real_estate', 'Queanbeyan, Jerrabomberra - ACT/NSW border region', $json$
{ "name": "Ray White Queanbeyan | Jerrabomberra", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Queanbeyan", "location_hq_country": "Australia", "description": "Ray White franchise office positioned in the Queanbeyan CBD, servicing the growing Queanbeyan-Jerrabomberra corridor bordering the ACT.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0010', 'real_estate', 'Canberra & Queanbeyan, ACT/NSW border region', $json$
{ "name": "MARQ Property", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Gungahlin", "location_hq_country": "Australia", "description": "Real estate agency servicing sellers, buyers and investors across the broader ACT and Queanbeyan region, with an active local community presence.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0011', 'real_estate', 'Woden, Phillip - Canberra, ACT', $json$
{ "name": "Red Brick Properties", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Phillip", "location_hq_country": "Australia", "description": "Real estate agency based in Phillip with excellent knowledge of the Woden real estate market, servicing sellers, buyers and renters.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Nalin Ratnaike", "member_position_title": "Principal & Director" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0012', 'real_estate', 'Belconnen, Canberra, ACT', $json$
{ "name": "Blackshaw Belconnen", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Belconnen", "location_hq_country": "Australia", "description": "Blackshaw franchise office established in 2017, a family-owned business supporting local charities and community groups in the Belconnen area.", "founded": 2017, "type": "Privately Held (Blackshaw franchise)", "websites_main": "https://www.blackshaw.com.au/office-belconnen", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0013', 'real_estate', 'Woden, Weston Creek - Canberra, ACT', $json$
{ "name": "LJ Hooker Woden | Weston", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Woden", "location_hq_country": "Australia", "description": "LJ Hooker franchise office servicing Woden and Weston across residential sales and property management.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": "https://westoncreek.ljhooker.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0014', 'real_estate', 'Manuka, South Canberra, ACT', $json$
{ "name": "LJ Hooker Manuka", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Manuka", "location_hq_country": "Australia", "description": "LJ Hooker franchise office based in Manuka Village, specialising in residential property sales, auctions and property management across Canberra's Inner South including Griffith, Narrabundah, Deakin, Red Hill, Yarralumla, Kingston and Barton.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": "https://manuka.ljhooker.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Stephen Thompson", "member_position_title": "Owner & Principal" } ], "specialities": ["Residential Sales", "Auctions", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0015', 'real_estate', 'Tuggeranong, Canberra, ACT', $json$
{ "name": "McCann Properties", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Tuggeranong", "location_hq_country": "Australia", "description": "Independent real estate agency located in Tuggeranong, serving buyers, sellers and renters with deep local market knowledge.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Mark McCann", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0016', 'real_estate', 'Tuggeranong, Canberra, ACT', $json$
{ "name": "Blackshaw Tuggeranong", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Tuggeranong", "location_hq_country": "Australia", "description": "Blackshaw franchise office independently operated in Tuggeranong, bringing together experienced sales agents, property managers and administration staff.", "founded": null, "type": "Privately Held (Blackshaw franchise)", "websites_main": "https://www.blackshaw.com.au/office-tuggeranong", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Robert Peaker", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0017', 'real_estate', 'Manuka, Griffith - South Canberra, ACT', $json$
{ "name": "Blackshaw Manuka", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Manuka", "location_hq_country": "Australia", "description": "The original Blackshaw Real Estate agency, established in 1988, briefly trading from Griffith before moving to its current Manuka offices in 1990.", "founded": 1988, "type": "Privately Held (Blackshaw franchise)", "websites_main": "https://www.blackshaw.com.au/office-manuka", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-CBR-0018', 'real_estate', 'Kingston Foreshore, South Canberra, ACT', $json$
{ "name": "Berkely Residential", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Kingston", "location_hq_country": "Australia", "description": "Award-winning real estate agency based on the Kingston Foreshore, servicing home buyers, investors, sellers and renters across South Canberra.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0103', 'real_estate', 'Hunters Hill, Lane Cove, Lower North Shore, Sydney', $json$
{ "name": "Laing+Simmons Hunters Hill & Lane Cove", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Hunters Hill", "location_hq_country": "Australia", "description": "Laing+Simmons franchise office servicing Hunters Hill and Lane Cove, offering sales, property management, project marketing and auction services.", "founded": null, "type": "Privately Held (Laing+Simmons franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "John Priddy", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management", "Project Marketing", "Auctions"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0104', 'real_estate', 'Lane Cove, Lower North Shore, Sydney', $json$
{ "name": "Raine & Horne Lane Cove", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Lane Cove", "location_hq_country": "Australia", "description": "Raine & Horne franchise office and residential real estate specialist servicing Lane Cove and the Lower North Shore.", "founded": null, "type": "Privately Held (Raine & Horne franchise)", "websites_main": "https://www.raineandhorne.com.au/lanecove", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Stuart Bourne", "member_position_title": "Founder & Selling Principal" }, { "member_full_name": "Alex Banning", "member_position_title": "Principal" }, { "member_full_name": "Nathan Westerbrink", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0105', 'real_estate', 'Lane Cove, Lower North Shore, Sydney', $json$
{ "name": "LJ Hooker Lane Cove", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Lane Cove", "location_hq_country": "Australia", "description": "LJ Hooker franchise office servicing Lane Cove and surrounding Lower North Shore suburbs.", "founded": null, "type": "Privately Held (LJ Hooker franchise)", "websites_main": "https://lanecove.ljhooker.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0106', 'real_estate', 'Emu Heights, Nepean Valley / Lower Blue Mountains, Western Sydney', $json$
{ "name": "Merrick Property Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Emu Heights", "location_hq_country": "Australia", "description": "Independent real estate agency specialising in the sale and marketing of residential and acreage properties throughout the Nepean Valley and Lower Blue Mountains.", "founded": null, "type": "Privately Held", "websites_main": "https://merrickpropertygroup.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Paul Merrick", "member_position_title": "Founder & Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0107', 'real_estate', 'Penrith, Western Sydney', $json$
{ "name": "One Agency Penrith", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Penrith", "location_hq_country": "Australia", "description": "One Agency franchise office servicing Penrith and surrounding suburbs including Cranebrook, Emu Plains, Glenmore Park and Jordan Springs.", "founded": null, "type": "Privately Held (One Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Trent Waters", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0108', 'real_estate', 'Nepean District, Western Sydney', $json$
{ "name": "Ray White Nepean Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Penrith", "location_hq_country": "Australia", "description": "Ray White franchise group specialising in the sale and leasing of residential, strata titled and rural homes across the Nepean District.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://rwng.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Leasing", "Rural Property"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0109', 'real_estate', 'Penrith, Western Sydney', $json$
{ "name": "PRD Penrith", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Penrith", "location_hq_country": "Australia", "description": "PRD franchise office servicing Penrith across residential sales and new project marketing.", "founded": null, "type": "Privately Held (PRD franchise)", "websites_main": "https://www.prd.com.au/penrith", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Project Marketing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0110', 'real_estate', 'Penrith, Western Sydney', $json$
{ "name": "Property Central Penrith", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Penrith", "location_hq_country": "Australia", "description": "Award-winning independent real estate agency servicing Penrith, Cranebrook, Jordan Springs, Werrington County, Cambridge Park, Jamisontown, Kingswood and Leonay.", "founded": null, "type": "Privately Held", "websites_main": "https://www.propertycentralpenrith.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0111', 'real_estate', 'Liverpool, South West Sydney', $json$
{ "name": "Raine & Horne Liverpool", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Liverpool", "location_hq_country": "Australia", "description": "Raine & Horne franchise office covering residential sales and property management across the Liverpool 2170 region.", "founded": null, "type": "Privately Held (Raine & Horne franchise)", "websites_main": "https://www.raineandhorne.com.au/liverpool", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Vince Labbozetta", "member_position_title": "Principal" }, { "member_full_name": "Michael Busdon", "member_position_title": "Principal" } ], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0112', 'real_estate', 'Liverpool, Campbelltown - South West Sydney', $json$
{ "name": "One Agency Liverpool - C&P Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Liverpool", "location_hq_country": "Australia", "description": "One Agency franchise office serving the Sydney Southwest community since 1988, with offices in Campbelltown and Liverpool managing over 2,200 properties.", "founded": 1988, "type": "Privately Held (One Agency franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0113', 'real_estate', 'Liverpool, Warwick Farm, Casula, Lurnea - South West Sydney', $json$
{ "name": "Century 21 Combined Liverpool", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Liverpool", "location_hq_country": "Australia", "description": "Century 21 franchise office covering Liverpool, Warwick Farm, Casula and Lurnea across residential real estate.", "founded": null, "type": "Privately Held (Century 21 franchise)", "websites_main": "https://liverpool.century21.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-SYD-0114', 'real_estate', 'Liverpool, Casula, Wetherill Park - South West Sydney', $json$
{ "name": "Award Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Liverpool", "location_hq_country": "Australia", "description": "Independent real estate agency servicing Liverpool, Casula, Wetherill Park and surrounding South West Sydney suburbs.", "founded": null, "type": "Privately Held", "websites_main": "https://www.awardrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0021', 'real_estate', 'Wagga Wagga, Riverina, NSW', $json$
{ "name": "Belle Property Wagga Wagga", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wagga Wagga", "location_hq_country": "Australia", "description": "Belle Property franchise office delivering premium service across Wagga Wagga and the Riverina region.", "founded": null, "type": "Privately Held (Belle Property franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Holly Newbigging", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0022', 'real_estate', 'Wagga Wagga, Riverina, NSW', $json$
{ "name": "Macarthur Real Estate Agency", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wagga Wagga", "location_hq_country": "Australia", "description": "Award-winning real estate agency founded in 2020, offering a holistic approach covering land development, sub-division, residential sales and property management in the Riverina.", "founded": 2020, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Mark Macarthur", "member_position_title": "Founder & Director" } ], "specialities": ["Residential Sales", "Property Management", "Land Development"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0023', 'real_estate', 'Wagga Wagga, Riverina, NSW', $json$
{ "name": "John Mooney Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wagga Wagga", "location_hq_country": "Australia", "description": "Locally owned and operated independent real estate agency in business for more than 25 years, offering residential sales, rural sales and property management across the Riverina.", "founded": null, "type": "Privately Held", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Rural Property", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0024', 'real_estate', 'Wagga Wagga, Riverina, NSW', $json$
{ "name": "PRD Real Estate Wagga Wagga", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wagga Wagga", "location_hq_country": "Australia", "description": "PRD franchise office and Wagga's leading real estate and property management agency, servicing residential, commercial and rural property needs.", "founded": null, "type": "Privately Held (PRD franchise)", "websites_main": "https://prdwagga.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Commercial Real Estate", "Rural Property", "Property Management"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0025', 'real_estate', 'Wagga Wagga, Riverina, NSW', $json$
{ "name": "Ray White Wagga Wagga", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Wagga Wagga", "location_hq_country": "Australia", "description": "Ray White franchise office servicing Wagga Wagga, Kooringal, Coolamon and Ashmont across residential sales and leasing.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": null, "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0026', 'real_estate', 'Lismore, Northern Rivers, NSW', $json$
{ "name": "Ray White Lismore", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Lismore", "location_hq_country": "Australia", "description": "Ray White franchise office combining local knowledge and industry experience to create a leading presence in the Lismore real estate market.", "founded": null, "type": "Privately Held (Ray White franchise)", "websites_main": "https://raywhitelismore.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Chris Harley", "member_position_title": "Principal" }, { "member_full_name": "Neil Scott", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0027', 'real_estate', 'Lismore, Ballina, Byron Bay - Northern Rivers, NSW', $json$
{ "name": "Harcourts Northern Rivers", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Byron Bay", "location_hq_country": "Australia", "description": "Harcourts franchise operating across Lismore, Ballina and Byron Bay, offering property management, sales and rentals across the Northern Rivers region.", "founded": null, "type": "Privately Held (Harcourts franchise)", "websites_main": "https://harcourtsnr.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Steve Leslie", "member_position_title": "Director" }, { "member_full_name": "Natalie Leslie", "member_position_title": "Director" } ], "specialities": ["Residential Sales", "Property Management", "Leasing"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0028', 'real_estate', 'Byron Bay, Northern Rivers, NSW', $json$
{ "name": "Byron Bay Real Estate Agency", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Byron Bay", "location_hq_country": "Australia", "description": "Independent real estate agency opened in 1993, with principals recognised as industry experts appearing on national media including Sky News.", "founded": 1993, "type": "Privately Held", "websites_main": "https://www.byronbayrealestateagency.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Tony Farrell", "member_position_title": "Principal" }, { "member_full_name": "Liam Annesley", "member_position_title": "Principal" }, { "member_full_name": "Glen Irwin", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0029', 'real_estate', 'Byron Bay, Ballina, Lennox Head - Northern Rivers, NSW', $json$
{ "name": "McGrath Northern Rivers Group", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Byron Bay", "location_hq_country": "Australia", "description": "McGrath franchise group servicing the Northern Rivers region across Byron Bay, Ballina and Lennox Head.", "founded": null, "type": "Privately Held (McGrath franchise)", "websites_main": "https://mcgrathnr.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research'),

('RE-NSW-0030', 'real_estate', 'Lismore, Ballina, Byron Bay - Northern Rivers, NSW', $json$
{ "name": "Katrina Beohm Real Estate", "industry": "Real Estate", "size_range": null, "size_employees_count": null, "location_hq_city": "Ballina", "location_hq_country": "Australia", "description": "Independent real estate agency with offices across Lismore, Ballina and Byron Bay in the Northern Rivers region.", "founded": null, "type": "Privately Held", "websites_main": "https://www.kbrealestate.com.au", "websites_linkedin": null, "active_job_postings_count": null, "employees_count_change": { "change_yearly_percentage": null }, "active_job_postings_count_change": { "change_monthly_percentage": null }, "last_funding_round": null, "key_executives": [ { "member_full_name": "Katrina Beohm", "member_position_title": "Principal" } ], "specialities": ["Residential Sales"], "news_articles": [] }
$json$::jsonb, 'manual_research');
