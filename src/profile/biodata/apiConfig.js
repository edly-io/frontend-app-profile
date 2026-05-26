import { ensureConfig, getConfig } from '@edx/frontend-platform';
import { BIODATA_SECTION_MAP } from './config';

ensureConfig(['LMS_BASE_URL'], 'Biodata API config');

export const BIODATA_API_DEFAULT_BASE_PATH = '/fbr/api/biodata';
export const BIODATA_VALIDATE_PATH = 'v1/validate/';

export function normalizeBiodataPath(path) {
  return path.replace(/^\//, '');
}

export function getBiodataApiBaseUrl() {
  const { LMS_BASE_URL, BIODATA_API_BASE_URL } = getConfig();

  if (BIODATA_API_BASE_URL) {
    return BIODATA_API_BASE_URL.replace(/\/$/, '');
  }

  return `${LMS_BASE_URL}${BIODATA_API_DEFAULT_BASE_PATH}`;
}

export function getBiodataTargetUserId() {
  if (typeof window === 'undefined') {
    return null;
  }

  const targetUserId = new URLSearchParams(window.location.search).get('for_user');
  return targetUserId ? String(targetUserId).trim() : null;
}

export function getBiodataEndpointUrl(path, options = {}) {
  const { includeTargetUser = false } = options;
  const url = new URL(`${getBiodataApiBaseUrl()}/${normalizeBiodataPath(path)}`);
  const targetUserId = includeTargetUser ? getBiodataTargetUserId() : null;

  if (targetUserId) {
    url.searchParams.set('for_user', targetUserId);
  }

  return url.toString();
}

export const BIODATA_SECTION_ENDPOINTS = {
  basicInformation: {
    flat: {
      path: 'v1/basic-information/',
      submissionSupported: true,
      fieldMap: {
        title: 'profile_title',
        full_name: 'profile_full_name',
        preferred_name: 'preferred_calling_name',
        cnic: 'identity_card_number',
        cnic_front: 'cnic_front',
        cnic_back: 'cnic_back',
        date_of_birth: 'date_of_birth',
        place_of_birth: 'place_of_birth',
        domicile_district: 'district_of_domicile',
        province_of_domicile: 'province_of_domicile',
        domicile_file: 'domicile_file',
        religion: 'religion',
        marital_status: 'marital_status',
        children_count: 'number_of_children',
        sons_count: 'sons',
        daughters_count: 'daughters',
      },
    },
  },
  physicalMedicalInformation: {
    flat: {
      path: 'v1/physical-medical/',
      submissionSupported: true,
      fieldMap: {
        medical_checkup_date: 'last_annual_medical_checkup',
        height: 'height',
        weight: 'weight',
      },
    },
  },
  contactInformation: {
    flat: {
      path: 'v1/contact-information/',
      submissionSupported: true,
      fieldMap: {
        permanent_address: 'permanent_residential_address',
        permanent_phone: 'permanent_phone_number',
        present_address: 'present_residential_address',
        present_phone: 'present_phone_number',
        lahore_address: 'contact_address_lahore',
        lahore_phone: 'lahore_phone_number',
        mobile: 'mobile_number',
        email: 'contact_email',
      },
    },
  },
  education: {
    repeatables: {
      education_records: {
        path: 'v1/education/',
        submissionSupported: false,
        fieldMap: {
          institute: 'educational_institute',
          attended_from: 'attended_from',
          attended_to: 'attended_to',
          examination: 'examination',
          year_of_passing: 'year_of_passing',
          grade: 'grade_division',
          subjects: 'subjects_studied',
          degree_file: 'education_degree_attachment',
        },
      },
    },
  },
  achievements: {
    flat: {
      path: 'v1/achievements/',
      submissionSupported: true,
      fieldMap: {
        not_applicable: 'achievements_not_applicable',
        distinctions: 'distinctions',
        scholarships: 'scholarships',
        awards: 'awards',
      },
    },
  },
  languages: {
    repeatables: {
      language_proficiencies: {
        path: 'v1/languages/',
        submissionSupported: false,
        fieldMap: {
          language: 'language_name',
          speaking: 'speaking_proficiency',
          reading: 'reading_proficiency',
          writing: 'writing_proficiency',
        },
      },
    },
  },
  employment: {
    flat: {
      path: 'v1/employment/',
      submissionSupported: true,
      fieldMap: {
        not_applicable: 'is_first_job',
        employment_gap_details: 'first_employment_gap_details_after_education',
      },
    },
    repeatables: {
      employment_records: {
        path: 'v1/employment-records/',
        skipWhenFlatFieldEquals: {
          fieldName: 'not_applicable',
          value: true,
        },
        skipWhenFieldEquals: {
          fieldName: 'is_first_job',
          value: 'Yes',
        },
        submissionSupported: false,
        fieldMap: {
          organization: 'organization_office',
          designation: 'designation_place_of_posting',
          from_date: 'from',
          to_date: 'to',
        },
      },
    },
  },
  competitiveExaminations: {
    repeatables: {
      competitive_examinations: {
        path: 'v1/competitive-examinations/',
        fallbackNaFieldName: 'competitive_examinations_not_applicable',
        extraFieldMap: {
          not_applicable: 'competitive_examinations_not_applicable',
        },
        extraFieldsMethod: 'post',
        mergeExtraFieldsIntoRows: true,
        submissionSupported: false,
        fieldMap: {
          examination_name: 'examination_name',
          agency: 'agency_holding_examination',
          year: 'year',
          result_details: 'result_details',
          merit_position: 'merit_position_if_qualified',
        },
      },
    },
  },
  cssExamDetails: {
    flat: {
      path: 'v1/css-exam-details/',
      submissionSupported: true,
      fieldMap: {
        roll_number: 'css_roll_number',
        merit_position: 'css_merit_position',
        chances_availed: 'css_chances_availed',
        applied_forthcoming: 'applied_for_forthcoming_css_exam',
        intend_forthcoming: 'intend_to_sit_for_forthcoming_css_exam',
        last_chance: 'last_chance_date_year',
        mark_sheet: 'css_marksheet_attachment',
      },
    },
    repeatables: {
      occupational_service_group_preferences: {
        path: 'v1/service-group-preferences/',
        rowMethod: 'post',
        batchRows: true,
        dedupeBy: 'service_group',
        submissionSupported: false,
        fieldMap: {
          service_group: 'service_group',
          priority: 'priority',
        },
      },
      css_subject_marks: {
        path: 'v1/css-subject-marks/',
        rowMethod: 'post',
        batchRows: true,
        dedupeBy: 'subject',
        submissionSupported: false,
      },
    },
  },
  governmentServiceDetails: {
    flat: {
      path: 'v1/government-service/',
      submissionSupported: true,
      fieldMap: {
        govt_service_date: 'date_joining_any_govt_service_before_csa',
        dept_name: 'department_name',
        csa_joining_date: 'date_joining_civil_services_academy_lahore',
        irs_joining_date: 'date_joining_transfer_inland_revenue_service',
        has_other_income: 'other_income_source_besides_salary',
        other_income_details: 'other_income_details',
      },
    },
  },
  personalInterests: {
    flat: {
      path: 'v1/personal-interests/',
      submissionSupported: true,
      fieldMap: {
        games_played: 'games_played',
        game_awards: 'game_distinctions_awards',
        hobbies: 'hobbies',
      },
    },
  },
  foreignVisits: {
    repeatables: {
      foreign_visits: {
        path: 'v1/foreign-visits/',
        fallbackNaFieldName: 'foreign_visits_not_applicable',
        extraFieldMap: {
          not_applicable: 'foreign_visits_not_applicable',
        },
        extraFieldsMethod: 'post',
        mergeExtraFieldsIntoRows: true,
        submissionSupported: false,
        fieldMap: {
          country: 'country',
          purpose: 'purpose_of_visit',
          visit_type: 'self_or_sponsored_visit',
          from_date: 'from',
          to_date: 'to',
        },
      },
    },
  },
  familyInformation: {
    flat: {
      path: 'v1/family-information/',
      submissionSupported: true,
      fieldMap: {
        father_name: 'father_name',
        father_education: 'father_education',
        father_occupation: 'father_occupation',
        father_address: 'father_address',
        father_phone: 'father_phone_number',
        mother_name: 'mother_name',
        mother_education: 'mother_education',
        mother_occupation: 'mother_occupation',
        mother_address: 'mother_address',
        mother_phone: 'mother_phone_number',
      },
    },
  },
  siblings: {
    repeatables: {
      siblings_family_information: {
        path: 'v1/siblings/',
        fallbackNaFieldName: 'siblings_not_applicable',
        extraFieldMap: {
          not_applicable: 'siblings_not_applicable',
        },
        extraFieldsMethod: 'post',
        mergeExtraFieldsIntoRows: true,
        submissionSupported: false,
        fieldMap: {
          relationship: 'relationship',
          name: 'name',
          education: 'education',
          occupation: 'occupation',
          address: 'address',
        },
      },
    },
  },
  closeRelativesInGovernmentService: {
    repeatables: {
      close_relatives_in_government_service: {
        path: 'v1/government-relatives/',
        fallbackNaFieldName:
          'close_relatives_in_government_service_not_applicable',
        extraFieldMap: {
          not_applicable:
            'close_relatives_in_government_service_not_applicable',
        },
        extraFieldsMethod: 'post',
        mergeExtraFieldsIntoRows: true,
        submissionSupported: false,
      },
    },
  },
  spouseInformation: {
    flat: {
      path: 'v1/spouse-information/',
      submissionSupported: true,
      fieldMap: {
        spouse_name: 'spouse_name',
        spouse_education: 'spouse_education',
        spouse_occupation: 'spouse_occupation',
        spouse_address: 'spouse_address',
        spouse_phone: 'spouse_phone',
      },
    },
  },
  declaration: {
    flat: {
      path: 'v1/declaration/',
      submissionSupported: true,
      fieldMap: {
        confirmed: 'declaration_confirmed',
        date: 'declaration_date_demo',
      },
    },
  },
};

export function getSectionEndpointConfig(sectionId) {
  return BIODATA_SECTION_ENDPOINTS[sectionId] || null;
}

export function getSectionRepeatableEndpointConfig(
  sectionId,
  storageFieldName,
) {
  return (
    getSectionEndpointConfig(sectionId)?.repeatables?.[storageFieldName] || null
  );
}

export function getSectionFlatFieldNames(section) {
  const sectionEndpointConfig = getSectionEndpointConfig(section.id);
  const baseFieldNames = [
    ...(section.fields || []).map(({ fieldName }) => fieldName),
    ...(section.fileFields || []).map(({ fieldName }) => fieldName),
  ];
  const extraFieldNames = sectionEndpointConfig?.flat?.extraFieldNames || [];

  return [...new Set([...baseFieldNames, ...extraFieldNames])];
}

export function getFlatUiToApiFieldMap(sectionId) {
  const fieldMap = getSectionEndpointConfig(sectionId)?.flat?.fieldMap || {};

  return Object.entries(fieldMap).reduce(
    (accumulator, [apiFieldName, uiFieldName]) => {
      accumulator[uiFieldName] = apiFieldName;
      return accumulator;
    },
    {},
  );
}

export function getFlatApiToUiFieldMap(sectionId) {
  return getSectionEndpointConfig(sectionId)?.flat?.fieldMap || {};
}

export function sectionSupportsBackendSubmission(sectionId) {
  return Boolean(
    getSectionEndpointConfig(sectionId)?.flat?.submissionSupported,
  );
}

export function repeatableSupportsBackendSubmission(
  sectionId,
  storageFieldName,
) {
  return Boolean(
    getSectionRepeatableEndpointConfig(sectionId, storageFieldName)
      ?.submissionSupported,
  );
}

export function getRepeatableFallbackNaFieldName(sectionId, storageFieldName) {
  return (
    getSectionRepeatableEndpointConfig(sectionId, storageFieldName)
      ?.fallbackNaFieldName || null
  );
}

export function getRepeatableExtraFieldNames(sectionId, storageFieldName) {
  const endpointConfig = getSectionRepeatableEndpointConfig(
    sectionId,
    storageFieldName,
  );

  return [
    ...Object.values(endpointConfig?.extraFieldMap || {}),
    ...(endpointConfig?.extraFieldNames || []),
    ...(!endpointConfig?.extraFieldMap && endpointConfig?.fallbackNaFieldName
      ? [endpointConfig.fallbackNaFieldName]
      : []),
  ];
}

export function getRepeatableExtraUiToApiFieldMap(sectionId, storageFieldName) {
  const extraFieldMap = (
    getSectionRepeatableEndpointConfig(sectionId, storageFieldName)
      ?.extraFieldMap
    || {}
  );

  return Object.entries(extraFieldMap).reduce(
    (accumulator, [apiFieldName, uiFieldName]) => {
      accumulator[uiFieldName] = apiFieldName;
      return accumulator;
    },
    {},
  );
}

export function getSectionRepeatableConfigs(section) {
  return (section.repeatables || [])
    .map((repeatable) => ({
      repeatable,
      endpoint: getSectionRepeatableEndpointConfig(
        section.id,
        repeatable.storageFieldName,
      ),
    }))
    .filter(({ endpoint }) => Boolean(endpoint));
}

export function getRepeatableUiToApiFieldMap(sectionId, storageFieldName) {
  const fieldMap = (
    getSectionRepeatableEndpointConfig(sectionId, storageFieldName)?.fieldMap
    || {}
  );

  return Object.entries(fieldMap).reduce(
    (accumulator, [apiFieldName, uiFieldName]) => {
      accumulator[uiFieldName] = apiFieldName;
      return accumulator;
    },
    {},
  );
}

export function getRepeatableApiToUiFieldMap(sectionId, storageFieldName) {
  return (
    getSectionRepeatableEndpointConfig(sectionId, storageFieldName)?.fieldMap
    || {}
  );
}

export function getConfiguredBiodataSections() {
  return Object.keys(BIODATA_SECTION_ENDPOINTS)
    .map((sectionId) => BIODATA_SECTION_MAP[sectionId])
    .filter(Boolean);
}
