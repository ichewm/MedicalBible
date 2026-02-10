# FHIR Resource Mappings for Medical Bible Platform

## Overview

This document defines how the Medical Bible platform's data model maps to HL7 FHIR R4 resources. The mappings enable healthcare interoperability and data exchange with external FHIR-compliant systems.

## Mapping Strategy

### Core Principles
1. **Read-First Approach**: Primary use case is exporting Medical Bible data to external systems
2. **US Core Compliance**: Align with US Core Implementation Guide where applicable
3. **Minimal Extension**: Use standard FHIR resources; create custom extensions only when necessary
4. **System Identification**: Use identifier systems to distinguish Medical Bible data from other sources

### System Identifier
```json
{
  "system": "https://medicalbible.example.com/identifiers",
  "value": "{internal_id}"
}
```

## Resource Mappings

### 1. Patient Resource

**Maps from**: `users` table

#### Mapping Table

| FHIR Field | Source Field | Notes |
|------------|--------------|-------|
| `id` | `users.id` | Medical Bible internal user ID |
| `identifier[0].system` | "https://medicalbible.example.com/identifiers/user" | Fixed system URL |
| `identifier[0].value` | `users.id` | Internal user ID |
| `identifier[1].system` | "https://medicalbible.example.com/identifiers/phone" | Phone system |
| `identifier[1].value` | `users.phone` | Phone number |
| `identifier[2].system` | "https://medicalbible.example.com/identifiers/email" | Email system |
| `identifier[2].value` | `users.email` | Email address |
| `identifier[3].system` | "https://medicalbible.example.com/identifiers/invite-code" | Invite code system |
| `identifier[3].value` | `users.invite_code` | Personal invitation code |
| `name[0].text` | `users.username` | Display name/username |
| `telecom[0].system` | "phone" | Fixed |
| `telecom[0].value` | `users.phone` | Phone number |
| `telecom[1].system` | "email" | Fixed |
| `telecom[1].value` | `users.email` | Email address |
| `photo` | `users.avatar_url` | Profile photo URL |
| `extension[profession-level]` | `users.current_level_id` + joins | Custom extension for profession level |

#### Example Patient Resource

```json
{
  "resourceType": "Patient",
  "id": "12345",
  "identifier": [
    {
      "system": "https://medicalbible.example.com/identifiers/user",
      "value": "12345"
    },
    {
      "system": "https://medicalbible.example.com/identifiers/phone",
      "value": "+86-13800138000"
    },
    {
      "system": "https://medicalbible.example.com/identifiers/email",
      "value": "user@example.com"
    },
    {
      "system": "https://medicalbible.example.com/identifiers/invite-code",
      "value": "ABC12345"
    }
  ],
  "name": [
    {
      "text": "张医生",
      "use": "usual"
    }
  ],
  "telecom": [
    {
      "system": "phone",
      "value": "+86-13800138000",
      "use": "mobile"
    },
    {
      "system": "email",
      "value": "user@example.com",
      "use": "home"
    }
  ],
  "photo": [
    {
      "url": "https://cdn.medicalbible.example.com/avatars/12345.jpg",
      "contentType": "image/jpeg"
    }
  ],
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/profession-level",
      "extension": [
        {
          "url": "professionId",
          "valueInteger": 1
        },
        {
          "url": "professionName",
          "valueString": "临床检验师"
        },
        {
          "url": "levelId",
          "valueInteger": 2
        },
        {
          "url": "levelName",
          "valueString": "中级"
        }
      ]
    },
    {
      "url": "https://medicalbible.example.com/StructureDefinition/account-status",
      "valueCode": "active"
    }
  ]
}
```

---

### 2. Observation Resource (Exam Results)

**Maps from**: `user_answers`, `exam_sessions` tables

#### Mapping Table

| FHIR Field | Source Field | Notes |
|------------|--------------|-------|
| `id` | `user_answers.id` | Answer record ID |
| `status` | "final" | Fixed - completed assessment |
| `category[0].coding[0]` | LOINC: "exam" | Examination category |
| `code` | "exam-score" or "exam-attempt" | Type of observation |
| `subject` | `Patient/{user_id}` | Reference to patient |
| `encounter` | `Encounter/{session_id}` | Exam session reference |
| `effectiveDateTime` | `user_answers.created_at` | When the answer was recorded |
| `valueInteger` | Calculated score | 0-100 for score, 0/1 for correctness |
| `extension[question]` | `questions` join | Question details |
| `extension[paper]` | `papers` join | Paper/exam details |
| `extension[mode]` | `exam_sessions.mode` | Exam/practice mode |

#### Observation Types

1. **Exam Score Observation** - Overall score for an exam session
2. **Question Attempt Observation** - Individual question attempt

#### Example Exam Score Observation

```json
{
  "resourceType": "Observation",
  "id": "exam-score-98765",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "exam",
          "display": "Exam"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "https://medicalbible.example.com/CodeSystem/observation-type",
        "code": "exam-score",
        "display": "Exam Score"
      }
    ],
    "text": "临床免疫学 - 真题2023 - Score"
  },
  "subject": {
    "reference": "Patient/12345",
    "display": "张医生"
  },
  "encounter": {
    "reference": "Encounter/session-abc-123",
    "display": "Exam Session 2024-01-15"
  },
  "effectiveDateTime": "2024-01-15T10:30:00+08:00",
  "valueInteger": 85,
  "interpretation": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
          "code": "N",
          "display": "Normal"
        }
      ]
    }
  ],
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/exam-details",
      "extension": [
        {
          "url": "subjectId",
          "valueInteger": 5
        },
        {
          "url": "subjectName",
          "valueString": "临床免疫学"
        },
        {
          "url": "levelId",
          "valueInteger": 2
        },
        {
          "url": "levelName",
          "valueString": "中级"
        },
        {
          "url": "paperId",
          "valueInteger": 101
        },
        {
          "url": "paperName",
          "valueString": "真题2023"
        },
        {
          "url": "paperType",
          "valueCode": "past-exam"
        },
        {
          "url": "year",
          "valueInteger": 2023
        },
        {
          "url": "questionCount",
          "valueInteger": 100
        },
        {
          "url": "difficulty",
          "valueInteger": 3
        },
        {
          "url": "mode",
          "valueCode": "exam-mode"
        },
        {
          "url": "timeLimit",
          "valueInteger": 5400
        },
        {
          "url": "correctCount",
          "valueInteger": 85
        },
        {
          "url": "wrongCount",
          "valueInteger": 15
        }
      ]
    }
  ]
}
```

#### Example Question Attempt Observation

```json
{
  "resourceType": "Observation",
  "id": "question-attempt-98766",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "exam",
          "display": "Exam"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "https://medicalbible.example.com/CodeSystem/observation-type",
        "code": "question-attempt",
        "display": "Question Attempt"
      }
    ]
  },
  "subject": {
    "reference": "Patient/12345"
  },
  "partOf": [
    {
      "reference": "Observation/exam-score-98765"
    }
  ],
  "effectiveDateTime": "2024-01-15T10:32:15+08:00",
  "valueBoolean": true,
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/question-details",
      "extension": [
        {
          "url": "questionId",
          "valueInteger": 5001
        },
        {
          "url": "questionContent",
          "valueString": "下列哪种免疫球蛋白是五聚体？"
        },
        {
          "url": "questionType",
          "valueCode": "single-choice"
        },
        {
          "url": "correctOption",
          "valueString": "A"
        },
        {
          "url": "userOption",
          "valueString": "A"
        },
        {
          "url": "options",
          "valueString": "[{\"key\":\"A\",\"val\":\"IgM\"},{\"key\":\"B\",\"val\":\"IgG\"},{\"key\":\"C\",\"val\":\"IgA\"},{\"key\":\"D\",\"val\":\"IgD\"}]"
        },
        {
          "url": "sortOrder",
          "valueInteger": 1
        }
      ]
    }
  ]
}
```

---

### 3. Condition Resource (Wrong Questions)

**Maps from**: `user_wrong_books` table

Wrong questions represent areas where the user needs improvement - analogous to health conditions in clinical context.

#### Mapping Table

| FHIR Field | Source Field | Notes |
|------------|--------------|-------|
| `id` | `user_wrong_books.id` | Wrong book entry ID |
| `clinicalStatus` | "active" | While not mastered |
| `verificationStatus` | "confirmed" | User got it wrong |
| `category` | "learning-gap" | Custom category |
| `code` | Question/concept | The learning gap |
| `subject` | `Patient/{user_id}` | The learner |
| `note` | Question content + analysis | Learning note |
| `recordedDate` | `user_wrong_books.last_wrong_at` | Last wrong attempt |
| `extension` | Wrong count, subject info | Additional metadata |

#### Example Condition (Wrong Question)

```json
{
  "resourceType": "Condition",
  "id": "wrong-question-54321",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active",
        "display": "Active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        "code": "confirmed",
        "display": "Confirmed"
      }
    ]
  },
  "category": [
    {
      "coding": [
        {
          "system": "https://medicalbible.example.com/CodeSystem/condition-category",
          "code": "learning-gap",
          "display": "Learning Gap"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "https://medicalbible.example.com/CodeSystem/learning-topics",
        "code": "immunology-igm-structure",
        "display": "Immunology - IgM Structure"
      }
    ],
    "text": "IgM五聚体结构理解"
  },
  "subject": {
    "reference": "Patient/12345",
    "display": "张医生"
  },
  "note": [
    {
      "text": "下列哪种免疫球蛋白是五聚体？\n\n正确答案：A (IgM)\n\n解析：IgM是五聚体结构，是分子量最大的免疫球蛋白，也是机体早期免疫应答的重要抗体。"
    }
  ],
  "recordedDate": "2024-01-15T10:32:15+08:00",
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/wrong-question-details",
      "extension": [
        {
          "url": "questionId",
          "valueInteger": 5001
        },
        {
          "url": "subjectId",
          "valueInteger": 5
        },
        {
          "url": "subjectName",
          "valueString": "临床免疫学"
        },
        {
          "url": "wrongCount",
          "valueInteger": 3
        },
        {
          "url": "isDeleted",
          "valueBoolean": false
        }
      ]
    }
  ]
}
```

---

### 4. DocumentReference Resource (Lectures)

**Maps from**: `lectures`, `reading_progress` tables

#### Mapping Table

| FHIR Field | Source Field | Notes |
|------------|--------------|-------|
| `id` | `lectures.id` | Lecture ID |
| `status` | "current" | Active lecture |
| `type` | "lecture-material" | Document type |
| `subject` | `Patient/{user_id}` | For reading progress docs |
| `content[0].attachment.url` | `lectures.file_url` | PDF file URL |
| `content[0].attachment.title` | `lectures.title` | Lecture title |
| `content[0].attachment.pages` | `lectures.page_count` | Page count |
| `extension` | Subject info, highlights | Additional metadata |

#### Example DocumentReference (Lecture)

```json
{
  "resourceType": "DocumentReference",
  "id": "lecture-201",
  "status": "current",
  "type": {
    "coding": [
      {
        "system": "https://medicalbible.example.com/CodeSystem/document-type",
        "code": "lecture-material",
        "display": "Lecture Material"
      }
    ],
    "text": "临床免疫学讲义"
  },
  "subject": {
    "reference": "Patient/12345",
    "display": "张医生"
  },
  "content": [
    {
      "attachment": {
        "contentType": "application/pdf",
        "url": "https://cdn.medicalbible.example.com/lectures/clinical-immunology.pdf",
        "title": "临床免疫学重点讲解",
        "pages": 156
      }
    }
  ],
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/lecture-details",
      "extension": [
        {
          "url": "subjectId",
          "valueInteger": 5
        },
        {
          "url": "subjectName",
          "valueString": "临床免疫学"
        },
        {
          "url": "levelId",
          "valueInteger": 2
        },
        {
          "url": "levelName",
          "valueString": "中级"
        }
      ]
    },
    {
      "url": "https://medicalbible.example.com/StructureDefinition/reading-progress",
      "extension": [
        {
          "url": "lastPage",
          "valueInteger": 45
        },
        {
          "url": "progressPercent",
          "valueDecimal": 28.8
        },
        {
          "url": "lastReadAt",
          "valueDateTime": "2024-01-15T14:20:00+08:00"
        }
      ]
    }
  ]
}
```

---

### 5. Encounter Resource (Exam Sessions)

**Maps from**: `exam_sessions` table

#### Mapping Table

| FHIR Field | Source Field | Notes |
|------------|--------------|-------|
| `id` | `exam_sessions.id` | Session UUID |
| `status` | "finished" or "in-progress" | Based on session status |
| `class` | "exam" | Encounter class |
| `subject` | `Patient/{user_id}` | The examinee |
| `period.start` | `exam_sessions.start_at` | Start time |
| `period.end` | `exam_sessions.submit_at` | Submit time (if finished) |
| `length` | Calculated duration | Time spent |
| `extension` | Paper info, mode, score | Additional metadata |

#### Example Encounter (Exam Session)

```json
{
  "resourceType": "Encounter",
  "id": "session-abc-123",
  "status": "finished",
  "class": {
    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    "code": "exam",
    "display": "Exam"
  },
  "subject": {
    "reference": "Patient/12345",
    "display": "张医生"
  },
  "period": {
    "start": "2024-01-15T10:30:00+08:00",
    "end": "2024-01-15T12:15:00+08:00"
  },
  "length": 6300,
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/exam-session-details",
      "extension": [
        {
          "url": "paperId",
          "valueInteger": 101
        },
        {
          "url": "paperName",
          "valueString": "真题2023"
        },
        {
          "url": "mode",
          "valueCode": "exam-mode"
        },
        {
          "url": "timeLimit",
          "valueInteger": 5400
        },
        {
          "url": "questionCount",
          "valueInteger": 100
        },
        {
          "url": "score",
          "valueInteger": 85
        }
      ]
    }
  ]
}
```

---

### 6. Organization Resource (Platform Info)

**Maps from**: Static platform information

#### Example Organization

```json
{
  "resourceType": "Organization",
  "id": "medicalbible-platform",
  "name": "医学宝典",
  "alias": ["Medical Bible"],
  "telecom": [
    {
      "system": "url",
      "value": "https://www.medicalbible.example.com"
    }
  ],
  "type": [
    {
      "coding": [
        {
          "system": "https://medicalbible.example.com/CodeSystem/organization-type",
          "code": "medical-education-platform",
          "display": "Medical Education Platform"
        }
      ]
    }
  ]
}
```

---

### 7. Coverage Resource (Subscriptions)

**Maps from**: `subscriptions` table

#### Example Coverage (Active Subscription)

```json
{
  "resourceType": "Coverage",
  "id": "subscription-789",
  "status": "active",
  "type": {
    {
      "coding": [
        {
          "system": "https://medicalbible.example.com/CodeSystem/coverage-type",
          "code": "exam-prep-subscription",
          "display": "Exam Preparation Subscription"
        }
      ]
    }
  },
  "beneficiary": {
    "reference": "Patient/12345",
    "display": "张医生"
  },
  "period": {
    "start": "2024-01-01T00:00:00+08:00",
    "end": "2024-12-31T23:59:59+08:00"
  },
  "extension": [
    {
      "url": "https://medicalbible.example.com/StructureDefinition/subscription-details",
      "extension": [
        {
          "url": "levelId",
          "valueInteger": 2
        },
        {
          "url": "levelName",
          "valueString": "中级"
        },
        {
          "url": "professionId",
          "valueInteger": 1
        },
        {
          "url": "professionName",
          "valueString": "临床检验师"
        }
      ]
    }
  ]
}
```

---

## Custom Extensions

### Extension: Profession Level

**URL**: `https://medicalbible.example.com/StructureDefinition/profession-level`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/profession-level",
  "extension": [
    {
      "url": "professionId",
      "valueInteger": 1
    },
    {
      "url": "professionName",
      "valueString": "临床检验师"
    },
    {
      "url": "levelId",
      "valueInteger": 2
    },
    {
      "url": "levelName",
      "valueString": "中级"
    }
  ]
}
```

### Extension: Exam Details

**URL**: `https://medicalbible.example.com/StructureDefinition/exam-details`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/exam-details",
  "extension": [
    { "url": "subjectId", "valueInteger": 5 },
    { "url": "subjectName", "valueString": "临床免疫学" },
    { "url": "levelId", "valueInteger": 2 },
    { "url": "levelName", "valueString": "中级" },
    { "url": "paperId", "valueInteger": 101 },
    { "url": "paperName", "valueString": "真题2023" },
    { "url": "paperType", "valueCode": "past-exam" },
    { "url": "year", "valueInteger": 2023 },
    { "url": "questionCount", "valueInteger": 100 },
    { "url": "difficulty", "valueInteger": 3 },
    { "url": "mode", "valueCode": "exam-mode" },
    { "url": "timeLimit", "valueInteger": 5400 },
    { "url": "correctCount", "valueInteger": 85 },
    { "url": "wrongCount", "valueInteger": 15 }
  ]
}
```

### Extension: Question Details

**URL**: `https://medicalbible.example.com/StructureDefinition/question-details`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/question-details",
  "extension": [
    { "url": "questionId", "valueInteger": 5001 },
    { "url": "questionContent", "valueString": "题干内容" },
    { "url": "questionType", "valueCode": "single-choice" },
    { "url": "correctOption", "valueString": "A" },
    { "url": "userOption", "valueString": "A" },
    { "url": "options", "valueString": "JSON array" },
    { "url": "sortOrder", "valueInteger": 1 }
  ]
}
```

### Extension: Wrong Question Details

**URL**: `https://medicalbible.example.com/StructureDefinition/wrong-question-details`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/wrong-question-details",
  "extension": [
    { "url": "questionId", "valueInteger": 5001 },
    { "url": "subjectId", "valueInteger": 5 },
    { "url": "subjectName", "valueString": "临床免疫学" },
    { "url": "wrongCount", "valueInteger": 3 },
    { "url": "isDeleted", "valueBoolean": false }
  ]
}
```

### Extension: Lecture Details

**URL**: `https://medicalbible.example.com/StructureDefinition/lecture-details`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/lecture-details",
  "extension": [
    { "url": "subjectId", "valueInteger": 5 },
    { "url": "subjectName", "valueString": "临床免疫学" },
    { "url": "levelId", "valueInteger": 2 },
    { "url": "levelName", "valueString": "中级" }
  ]
}
```

### Extension: Reading Progress

**URL**: `https://medicalbible.example.com/StructureDefinition/reading-progress`

```json
{
  "url": "https://medicalbible.example.com/StructureDefinition/reading-progress",
  "extension": [
    { "url": "lastPage", "valueInteger": 45 },
    { "url": "progressPercent", "valueDecimal": 28.8 },
    { "url": "lastReadAt", "valueDateTime": "2024-01-15T14:20:00+08:00" }
  ]
}
```

---

## Code Systems

### Observation Type Code System

**System**: `https://medicalbible.example.com/CodeSystem/observation-type`

| Code | Display | Definition |
|------|---------|------------|
| `exam-score` | Exam Score | Overall score for an exam session |
| `question-attempt` | Question Attempt | Individual question attempt result |

### Condition Category Code System

**System**: `https://medicalbible.example.com/CodeSystem/condition-category`

| Code | Display | Definition |
|------|---------|------------|
| `learning-gap` | Learning Gap | Area requiring further study |

### Document Type Code System

**System**: `https://medicalbible.example.com/CodeSystem/document-type`

| Code | Display | Definition |
|------|---------|------------|
| `lecture-material` | Lecture Material | Educational lecture document |

### Coverage Type Code System

**System**: `https://medicalbible.example.com/CodeSystem/coverage-type`

| Code | Display | Definition |
|------|---------|------------|
| `exam-prep-subscription` | Exam Prep Subscription | Access to exam preparation materials |

---

## Implementation Notes

### Bundle Resources

Multiple related resources should be returned as a FHIR Bundle:

```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    { "resource": { "resourceType": "Patient", ... } },
    { "resource": { "resourceType": "Observation", ... } },
    { "resource": { "resourceType": "Encounter", ... } }
  ]
}
```

### Search Parameters

Common search parameters to support:

| Resource | Search Parameter | Example |
|----------|------------------|---------|
| Patient | identifier | `GET /Patient?identifier=12345` |
| Patient | phone | `GET /Patient?phone=13800138000` |
| Observation | subject | `GET /Observation?subject=Patient/12345` |
| Observation | code | `GET /Observation?code=exam-score` |
| Observation | date | `GET /Observation?date=ge2024-01-01` |
| Condition | subject | `GET /Condition?subject=Patient/12345` |
| DocumentReference | subject | `GET /DocumentReference?subject=Patient/12345` |
| Encounter | subject | `GET /Encounter?subject=Patient/12345` |

### Pagination

Support FHIR pagination using:
- `url` links in Bundle response
- `_count` parameter for page size
- `_offset` or continuation token for large datasets

### Security

- Require OAuth 2.0 Bearer token for all endpoints
- Implement scopes: `user/*.read`, `patient/*.read`
- Validate patient access to their own data only
- Audit log all FHIR API access

---

## Next Steps

1. **StructureDefinition Files**: Create正式的 FHIR StructureDefinition JSON files for custom extensions
2. **Implementation Guide**: Document full API conformance statement
3. **Validation**: Use FHIR validator to ensure resource conformance
4. **Testing**: Create test bundles for each resource type
