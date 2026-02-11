# Wearable Device Integration Research

> **Task**: INNOV-003 - Investigate wearable device integration (Apple Health, Google Fit)
> **Date**: 2026-02-08
> **Status**: Research Complete

---

## Executive Summary

This document summarizes research findings on integrating wearable health data from Apple HealthKit and Google Fit (now deprecated, migrating to Health Connect). Key finding: **neither platform provides direct backend REST APIs** - integration requires native mobile apps as intermediaries.

---

## 1. Apple HealthKit

### Platform Overview
- **Official Documentation**: [HealthKit | Apple Developer Documentation](https://developer.apple.com/documentation/healthkit)
- **Platform**: iOS, iPhone, Apple Watch
- **Architecture**: Native framework only - no backend REST API

### Key Limitations
- **No Backend API**: Apple does NOT provide a REST API for HealthKit
- **Native App Required**: Must have iOS app to access HealthKit data
- **User Permission Required**: Users must explicitly grant permissions for each data type

### Available Data Types
Based on [Health and Fitness Apps | Apple Developer](https://developer.apple.com/health-fitness/):
- **Steps**: `HKQuantityTypeIdentifierStepCount`
- **Heart Rate**: `HKQuantityTypeIdentifierHeartRate`
- **Sleep Analysis**: `HKCategoryTypeIdentifierSleepAnalysis`
- **Active Energy**: `HKQuantityTypeIdentifierActiveEnergyBurned`
- **Distance**: `HKQuantityTypeIdentifierDistanceWalkingRunning`
- **Workouts**: `HKWorkoutType`
- **Blood Pressure**: `HKQuantityTypeIdentifierBloodPressureSystolic`
- **Weight**: `HKQuantityTypeIdentifierBodyMass`

### Integration Architecture
```
[Apple Health App] <---> [HealthKit Framework]
                              ^
                              |
                         [Native iOS App]
                              |
                         (REST API Call)
                              |
                              v
                       [NestJS Backend]
```

### Resources
- [Getting Started with HealthKit - WWDC20](https://developer.apple.com/la/videos/play/wwdc2020/10664/)
- [Integrating Apple HealthKit Guide](https://krishanmadushankadev.medium.com/integrating-apple-healthkit-swift-8863d9784f45)

---

## 2. Google Fit (DEPRECATED)

### Critical Deprecation Notice
- **Status**: Google Fit REST API **deprecated in 2026**
- **New Signups**: Blocked since May 1, 2024
- **Full Shutdown**: August 31, 2024 for REST API v1
- **Migration Path**: Android Health Connect

### Documentation (Archival)
- [Getting Started with REST API | Google Fit](https://developers.google.com/fit/rest/v1/get-started)
- [API Reference | Google Fit](https://developers.google.com/fit/rest/v1/reference)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes)

### Why Not Use Google Fit
1. API is being fully deprecated
2. New developer signups blocked
3. Must migrate to Health Connect

---

## 3. Android Health Connect (Replacement)

### Platform Overview
- **Official Documentation**: [Health Connect | Android health & fitness](https://developer.android.com/health-and-fitness/health-connect)
- **Get Started Guide**: [Get started with Health Connect](https://developer.android.com/health-and-fitness/health-connect/get-started)
- **Data Types Reference**: [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types)

### Architecture
- **Native Android SDK only** - no direct backend REST API
- User-controlled data access
- Stores health and fitness data on-device

### Available Data Types
From [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types):
- **Steps**: `StepsRecord`
- **Heart Rate**: `HeartRateRecord`
- **Sleep**: `SleepSessionRecord`
- **Distance**: `DistanceRecord`
- **Calories**: `TotalCaloriesBurnedRecord`
- **Blood Pressure**: `BloodPressureRecord`
- **Weight**: `WeightRecord`
- **Hydration**: `HydrationRecord`
- **Nutrition**: `NutritionRecord`

### Integration Architecture
```
[Health Connect Store] <---> [Native Android App]
                                 |
                            (REST API Call)
                                 |
                                 v
                          [NestJS Backend]
```

---

## 4. Third-Party Aggregation Platforms

Given that neither Apple nor Google provide direct backend APIs, consider third-party platforms that offer unified REST APIs:

### Open Wearables
- **Website**: [Open Wearables - Unified Health Data Platform](https://openwearables.io/)
- **Description**: Open-source API platform connecting Garmin, Apple Health, Polar, Suunto
- **Advantage**: Single API instead of maintaining multiple integrations

### Thryve Wearable API
- **Website**: [Thryve Wearable API](https://www.thryve.health/product/wearable-api)
- **Description**: Integrates data from 500+ wearables and health trackers
- **Features**: Compliant, scalable digital health solutions

### Industry Insights
- **2026 Playbook**: [The 2026 Wearables Integration Playbook for Health Apps](https://www.themomentum.ai/resources/wearables-integration-playbook-for-health-apps)
- **Trends**: Unified APIs replacing individual integrations, focus on privacy with encryption

---

## 5. Recommended Integration Approach

### For Medical Bible Platform

Given the constraints (no direct backend APIs), the recommended architecture is:

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Device                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
            ┌───────▼──────┐    ┌──────▼──────┐
            │   iOS App    │    │ Android App │
            │ (HealthKit)  │    │(Health Conn)│
            └───────┬──────┘    └──────┬──────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                         (Sync Service)
                              │
                              v
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS Backend                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │            /wearable/health-data (POST)                   │  │
│  │  - Accepts JWT token from mobile app                      │  │
│  │  - Validates and stores health data                       │  │
│  │  - Returns sync status                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │          wearable_health_data Table                       │  │
│  │  - user_id, data_type, value, unit, timestamp             │  │
│  │  - source: 'healthkit' | 'health-connect'                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Phase 1**: Create backend API endpoints to receive health data
2. **Phase 2**: Build native iOS/Android apps with HealthKit/Health Connect SDKs
3. **Phase 3**: Implement periodic sync from mobile apps to backend
4. **Phase 4**: Consider third-party aggregation API for broader device support

---

## 6. Privacy and Regulatory Considerations

### Data Privacy Requirements
- **User Consent**: Explicit opt-in for each data type
- **Data Minimization**: Only collect necessary health metrics
- **Right to Deletion**: Users can delete their health data
- **Transparency**: Clear disclosure of data usage

### Regulatory Compliance
- **China Cybersecurity Law**: Health data is sensitive personal information
- **PIPL (Personal Information Protection Law)**: Requires explicit consent
- **GDPR** (if serving EU users): Special category health data

### Security Best Practices
- Encrypt data in transit (HTTPS/TLS)
- Encrypt health data at rest
- Use secure authentication (JWT with short expiry)
- Implement rate limiting to prevent abuse
- Log all data access for audit trails

---

## 7. Data Types for Proof of Concept

For the initial PoC, focus on high-value health metrics:

| Data Type | HealthKit Identifier | Health Connect Type | Priority |
|-----------|---------------------|---------------------|----------|
| Steps | `StepCount` | `StepsRecord` | High |
| Heart Rate | `HeartRate` | `HeartRateRecord` | High |
| Sleep | `SleepAnalysis` | `SleepSessionRecord` | Medium |
| Active Calories | `ActiveEnergyBurned` | `TotalCaloriesBurnedRecord` | Medium |
| Distance | `DistanceWalkingRunning` | `DistanceRecord` | Low |

---

## Sources

- [HealthKit | Apple Developer Documentation](https://developer.apple.com/documentation/healthkit)
- [Health and Fitness Apps | Apple Developer](https://developer.apple.com/health-fitness/)
- [Getting Started with HealthKit - WWDC20](https://developer.apple.com/la/videos/play/wwdc2020/10664/)
- [Health Connect | Android health & fitness](https://developer.android.com/health-and-fitness/health-connect)
- [Get started with Health Connect](https://developer.android.com/health-and-fitness/health-connect/get-started)
- [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types)
- [Getting Started with the REST API | Google Fit](https://developers.google.com/fit/rest/v1/get-started)
- [API Reference | Google Fit](https://developers.google.com/fit/rest/v1/reference)
- [Google Fit Migration FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq)
- [Open Wearables - Unified Health Data Platform](https://openwearables.io/)
- [Thryve Wearable API](https://www.thryve.health/product/wearable-api)
- [The 2026 Wearables Integration Playbook for Health Apps](https://www.themomentum.ai/resources/wearables-integration-playbook-for-health-apps)
