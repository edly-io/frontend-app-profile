import { BIODATA_SECTION_MAP } from './config';

export const BIODATA_API_DEFAULT_BASE_PATH = '/fbr/api/biodata';
export const BIODATA_VALIDATE_PATH = 'v1/validate/';

export const BIODATA_SECTION_ENDPOINTS = {
  basicInformation: {
    flat: {
      path: 'v1/basic-information/',
      fieldMap: {
        title: 'profile_title',
        full_name: 'profile_full_name',
        preferred_name: 'preferred_calling_name',
        cnic: 'identity_card_number',
        date_of_birth: 'date_of_birth',
        place_of_birth: 'place_of_birth',
        domicile_district: 'district_of_domicile',
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
        fieldMap: {
          institute: 'educational_institute',
          attended_from: 'attended_from',
          attended_to: 'attended_to',
          examination: 'examination',
          year_of_passing: 'year_of_passing',
          grade: 'grade_division',
          subjects: 'subjects_studied',
        },
      },
    },
  },
  achievements: {
    flat: {
      path: 'v1/achievements/',
    },
  },
  languages: {
    repeatables: {
      language_proficiencies: {
        path: 'v1/languages/',
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
      fieldMap: {
        employment_gap_details: 'first_employment_gap_details_after_education',
      },
    },
    repeatables: {
      employment_records: {
        path: 'v1/employment-records/',
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
      fieldMap: {
        roll_number: 'css_roll_number',
        merit_position: 'css_merit_position',
        service_preferences: 'occupational_service_group_preferences',
        chances_availed: 'css_chances_availed',
        applied_forthcoming: 'applied_for_forthcoming_css_exam',
        intend_forthcoming: 'intend_to_sit_for_forthcoming_css_exam',
        last_chance: 'last_chance_date_year',
      },
    },
    repeatables: {
      css_subject_marks: {
        path: 'v1/css-subject-marks/',
      },
    },
  },
  governmentServiceDetails: {
    flat: {
      path: 'v1/government-service/',
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
      fieldMap: {
        father_name: 'father_name',
        father_education: 'father_education',
        father_occupation: 'father_occupation',
        father_address: 'father_address_phone_number',
        mother_name: 'mother_name',
        mother_education: 'mother_education',
        mother_occupation: 'mother_occupation',
        mother_address: 'mother_address_phone_number',
      },
    },
    repeatables: {
      siblings_family_information: {
        path: 'v1/siblings/',
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
      },
    },
  },
  spouseInformation: {
    flat: {
      path: 'v1/spouse-information/',
      fieldMap: {
        spouse_name: 'spouse_name',
        spouse_education: 'spouse_education',
        spouse_occupation: 'spouse_occupation',
        spouse_address: 'spouse_address_phone_number',
      },
    },
  },
  declaration: {
    flat: {
      path: 'v1/declaration/',
      fieldMap: {
        confirmed: 'declaration_confirmed',
        date: 'declaration_date',
        signature: 'declaration_signature',
      },
    },
  },
};

export function getSectionEndpointConfig(sectionId) {
  return BIODATA_SECTION_ENDPOINTS[sectionId] || null;
}

export function getSectionRepeatableEndpointConfig(sectionId, storageFieldName) {
  return getSectionEndpointConfig(sectionId)?.repeatables?.[storageFieldName] || null;
}

export function getSectionFlatFieldNames(section) {
  const sectionEndpointConfig = getSectionEndpointConfig(section.id);
  const baseFieldNames = [
    ...((section.fields || []).map(({ fieldName }) => fieldName)),
    ...((section.fileFields || []).map(({ fieldName }) => fieldName)),
  ];
  const extraFieldNames = sectionEndpointConfig?.flat?.extraFieldNames || [];

  return [...new Set([...baseFieldNames, ...extraFieldNames])];
}

export function getFlatUiToApiFieldMap(sectionId) {
  const fieldMap = getSectionEndpointConfig(sectionId)?.flat?.fieldMap || {};

  return Object.entries(fieldMap).reduce((accumulator, [apiFieldName, uiFieldName]) => {
    accumulator[uiFieldName] = apiFieldName;
    return accumulator;
  }, {});
}

export function getFlatApiToUiFieldMap(sectionId) {
  return getSectionEndpointConfig(sectionId)?.flat?.fieldMap || {};
}

export function getRepeatableExtraFieldNames(sectionId, storageFieldName) {
  return getSectionRepeatableEndpointConfig(sectionId, storageFieldName)?.extraFieldNames || [];
}

export function getSectionRepeatableConfigs(section) {
  return (section.repeatables || []).map((repeatable) => ({
    repeatable,
    endpoint: getSectionRepeatableEndpointConfig(section.id, repeatable.storageFieldName),
  })).filter(({ endpoint }) => Boolean(endpoint));
}

export function getRepeatableUiToApiFieldMap(sectionId, storageFieldName) {
  const fieldMap = getSectionRepeatableEndpointConfig(sectionId, storageFieldName)?.fieldMap || {};

  return Object.entries(fieldMap).reduce((accumulator, [apiFieldName, uiFieldName]) => {
    accumulator[uiFieldName] = apiFieldName;
    return accumulator;
  }, {});
}

export function getRepeatableApiToUiFieldMap(sectionId, storageFieldName) {
  return getSectionRepeatableEndpointConfig(sectionId, storageFieldName)?.fieldMap || {};
}

export function getConfiguredBiodataSections() {
  return Object.keys(BIODATA_SECTION_ENDPOINTS)
    .map(sectionId => BIODATA_SECTION_MAP[sectionId])
    .filter(Boolean);
}
