# FHIR Standard Research and Requirements

## Overview

Fast Healthcare Interoperability Resources (FHIR) is a standard for exchanging healthcare information electronically. This document summarizes research on FHIR standards and CMS 2026 requirements for healthcare interoperability.

## CMS Interoperability Mandate (CMS-0057-F)

### Key Requirements for 2026-2027

The CMS Interoperability and Prior Authorization Final Rule establishes mandatory FHIR API implementation deadlines:

| Date | Requirement |
|------|-------------|
| January 1, 2026 | Public reporting begins for impacted payers |
| July 4, 2026 | Networks must expose data via modern FHIR APIs |
| January 1, 2027 | All mandated APIs must be live and operational |

### Prior Authorization Decision Timelines

- **Expedited requests**: Decisions within 72 hours
- **Standard requests**: Decisions within 7 calendar days

### Affected Organizations

- Impacted payers (excluding QHP issuers on the FFEs)
- Hospitals participating in Medicare programs
- Healthcare providers using EHR systems

### FHIR Standards Alignment

- **US Core Implementation Guide**: Required for API implementation
- **USCDI v3**: United States Core Data for Interoperability Version 3

### Medicare Promoting Interoperability Program (CY 2026)

- 180-day continuous EHR reporting period
- Digital quality measures based on HL7 FHIR standard

## FHIR R4 Standard Resources

### Core Resources for Healthcare Data

#### 1. Patient Resource
- **Purpose**: Defines demographics, care providers, and administrative information about a person receiving care
- **Key Elements**:
  - Identifiers (medical record numbers, insurance IDs)
  - Demographics (name, gender, birthDate, telecom)
  - Contact information and emergency contacts
  - Care providers and organization
  - Communication preferences and language

#### 2. Condition Resource
- **Purpose**: Records information about diseases/illnesses identified from clinical reasoning
- **Key Elements**:
  - Condition code and verification status
  - Clinical status (active, recurrence, remission)
  - Onset and abatement dates
  - Severity and body site
  - Evidence and notes

#### 3. Observation Resource
- **Purpose**: Captures measurements and subjective point-in-time assessments
- **Key Elements**:
  - Observation code (LOINC coding system)
  - Value and data type (quantity, code, string, etc.)
  - Status and effective date/time
  - Reference ranges and interpretation
  - Performer and subject references

#### 4. Medication Resources
- **Medication**: Defines medication details
- **MedicationRequest**: Prescriptions and orders
- **MedicationAdministration**: Records of medication given
- **MedicationStatement**: Patient's reported medication usage

#### 5. Additional Key Resources
- **Encounter**: Interactions between patient and healthcare provider
- **Practitioner**: People involved in healthcare delivery
- **Organization**: Healthcare organizations and facilities
- **Location**: Physical locations where care is provided
- **DiagnosticReport**: Grouped observations and interpretations

## Technical Specifications

### FHIR Version
- **Current Standard**: R4 (Release 4, v4.0.1)
- **Emerging**: R5 (Release 5) - Latest ballot versions available

### Data Exchange Formats
- **JSON**: Primary format for web APIs
- **XML**: Alternative format
- **Turtle**: RDF representation for semantic web

### API Interactions
- **Read**: Retrieve single resource by ID
- **Search**: Query resources based on criteria
- **Create**: POST new resources
- **Update**: PUT modifications to existing resources
- **Delete**: Remove resources (if supported)
- **Batch/Transaction**: Group operations
- **Operation**: Custom operations (e.g., $everything)

### Authentication and Security
- **OAuth 2.0**: Standard for API authorization
- **SMART on FHIR**: Profile for OAuth 2.0 in healthcare
- **TLS**: Required for all connections
- **JWT**: Token-based authentication

## US Core Implementation Guide

The US Core IG provides a baseline set of FHIR resources for US healthcare interoperability:

### Required US Core Profiles
- US Core Patient Profile
- US Core Condition Profile
- US Core Observation Profile
- US Core MedicationRequest Profile
- US Core Immunization Profile
- US Core DiagnosticReport Profile
- And more (20+ profiles total)

### Must-Support Elements
Each US Core profile defines "must support" elements that must be:
- Supported by the server (able to store and retrieve)
- Populated if data exists
- Properly validated

## Reference Resources

- [CMS Interoperability and Prior Authorization Final Rule](https://www.cms.gov/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f)
- [CMS Fact Sheet on Interoperability](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-and-prior-authorization-final-rule-cms-0057-f)
- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [US Core Implementation Guide](http://hl7.org/fhir/us/core/)
- [HL7 FHIR Official Site](https://hl7.org/fhir/)

## Sources

- [CMS Issues FY 2026 Hospital IPPS Proposed Rule](https://www.cmhealthlaw.com/2025/07/cms-issues-fy-2026-hospital-ipps-proposed-rule-and-ltch-pps-proposed-rule/)
- [Preparing for Mandated 2026 CMS Interoperability](https://health-chain.io/preparing-for-mandated-2026-cms-interoperability-requirements/)
- [CMS-0057-F Decoded: Must-have APIs](https://fire.ly/blog/cms-0057-f-decoded-must-have-apis-vs-nice-to-have-igs-for-2026-2027/)
- [CMS Interoperability: Q1 2026 Healthcare Executive Guide](https://www.invene.com/blog/ehr-interoperability)
- [The 2027 U.S. FHIR Mandate: What CMS-0057-F Really](https://www.datainterops.com/post/2027-us-fhir-mandate-cms-0057-f)
