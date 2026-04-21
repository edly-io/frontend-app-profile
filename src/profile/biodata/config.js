export const PROFILE_FIELD_TYPES = {
  TEXT: 'text',
  DATE: 'date',
  NUMBER: 'number',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  CHECKBOX: 'checkbox',
  FILE: 'file',
};

const YES_NO_OPTIONS = [
  { value: '', label: 'Select option' },
  { value: 'Yes', label: 'Yes' },
  { value: 'No', label: 'No' },
];

const TITLE_OPTIONS = [
  { value: '', label: 'Select title' },
  { value: 'mr', label: 'Mr' },
  { value: 'mrs', label: 'Mrs' },
  { value: 'ms', label: 'Ms' },
  { value: 'miss', label: 'Miss' },
];

const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Select marital status' },
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'divorced', label: 'Divorced' },
];

const PROFICIENCY_OPTIONS = [
  { value: '', label: 'Select proficiency' },
  { value: 'basic', label: 'Basic' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'native', label: 'Native' },
];

export const CSS_COMPULSORY_SUBJECT_MARKS = [
  { subject: 'English Essay', total_marks: '100', marks_obtained: '' },
  { subject: 'English Precise & Composition', total_marks: '100', marks_obtained: '' },
  { subject: 'General Science & Ability', total_marks: '100', marks_obtained: '' },
  { subject: 'Current Affairs', total_marks: '100', marks_obtained: '' },
  { subject: 'Pakistan Affairs', total_marks: '100', marks_obtained: '' },
  { subject: 'Islamic Studies', total_marks: '100', marks_obtained: '' },
  { subject: 'Viva Voce', total_marks: '300', marks_obtained: '' },
];

export const BIODATA_SECTIONS = [
  {
    id: 'basicInformation',
    title: 'Basic Information',
    helperText: 'Core personal biodata details.',
    fields: [
      {
        fieldName: 'profile_title', label: 'Title', type: PROFILE_FIELD_TYPES.SELECT, options: TITLE_OPTIONS,
      },
      { fieldName: 'profile_full_name', label: 'Full Name', placeholder: 'Enter full name' },
      { fieldName: 'preferred_calling_name', label: 'Preferred / calling name', placeholder: 'Enter preferred name' },
      { fieldName: 'identity_card_number', label: 'Identity Card Number', placeholder: 'Enter identity card number' },
      { fieldName: 'date_of_birth', label: 'Date of Birth', type: PROFILE_FIELD_TYPES.DATE },
      { fieldName: 'place_of_birth', label: 'Place of Birth', placeholder: 'Enter place of birth' },
      { fieldName: 'district_of_domicile', label: 'District of Domicile', placeholder: 'Enter district of domicile' },
      { fieldName: 'religion', label: 'Religion', placeholder: 'Enter religion' },
      {
        fieldName: 'marital_status', label: 'Marital Status', type: PROFILE_FIELD_TYPES.SELECT, options: MARITAL_STATUS_OPTIONS,
      },
      {
        fieldName: 'number_of_children', label: 'Number of Children', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: '0',
      },
      {
        fieldName: 'sons', label: 'Sons', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: '0',
      },
      {
        fieldName: 'daughters', label: 'Daughters', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: '0',
      },
    ],
    fileFields: [
      {
        fieldName: 'cnic_front',
        label: 'CNIC Front',
        accept: '.jpg,.jpeg,.png,.webp,.pdf',
      },
      {
        fieldName: 'cnic_back',
        label: 'CNIC Back',
        accept: '.jpg,.jpeg,.png,.webp,.pdf',
      },
      {
        fieldName: 'domicile_file',
        label: 'Domicile Attachment',
        accept: '.jpg,.jpeg,.png,.webp,.pdf',
      },
    ],
  },
  {
    id: 'physicalMedicalInformation',
    title: 'Physical / Medical Information',
    helperText: 'Medical checkup date and physical details.',
    fields: [
      { fieldName: 'last_annual_medical_checkup', label: 'Date of last annual medical checkup', type: PROFILE_FIELD_TYPES.DATE },
      {
        fieldName: 'height', label: 'Height (Inches)', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: 'Enter height in inches',
      },
      {
        fieldName: 'weight', label: 'Weight (kg)', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: 'Enter weight in kg',
      },
    ],
  },
  {
    id: 'contactInformation',
    title: 'Contact Information',
    helperText: 'Addresses, phones, and email details.',
    fields: [
      {
        fieldName: 'permanent_residential_address', label: 'Permanent residential address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter permanent residential address',
      },
      { fieldName: 'permanent_phone_number', label: 'Permanent phone number', placeholder: 'Enter permanent phone number' },
      {
        fieldName: 'present_residential_address', label: 'Present residential address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter present residential address',
      },
      { fieldName: 'present_phone_number', label: 'Present phone number', placeholder: 'Enter present phone number' },
      {
        fieldName: 'contact_address_lahore', label: 'Contact address at Lahore', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter Lahore contact address',
      },
      { fieldName: 'lahore_phone_number', label: 'Lahore phone number', placeholder: 'Enter Lahore phone number' },
      { fieldName: 'mobile_number', label: 'Mobile number', placeholder: 'Enter mobile number' },
      { fieldName: 'contact_email', label: 'Email', placeholder: 'Enter email address' },
    ],
  },
  {
    id: 'education',
    title: 'Education',
    helperText: 'Academic records are shown in reverse order.',
    repeatables: [
      {
        storageFieldName: 'education_records',
        addButtonLabel: 'Add education record',
        itemLabel: 'Education record',
        showRowNumber: false,
        emptyRow: {
          educational_institute: '',
          attended_from: '',
          attended_to: '',
          examination: '',
          year_of_passing: '',
          grade_division: '',
          subjects_studied: '',
          education_degree_attachment: null,
        },
        columns: [
          { key: 'educational_institute', label: 'Educational Institute', placeholder: 'Enter educational institute' },
          { key: 'attended_from', label: 'Attended From', type: PROFILE_FIELD_TYPES.DATE },
          { key: 'attended_to', label: 'Attended To', type: PROFILE_FIELD_TYPES.DATE },
          { key: 'examination', label: 'Examination', placeholder: 'Enter examination' },
          { key: 'year_of_passing', label: 'Year of Passing', placeholder: 'Enter year of passing' },
          { key: 'grade_division', label: 'Grade / Division', placeholder: 'Enter grade or division' },
          {
            key: 'subjects_studied', label: 'Subjects Studied', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter subjects studied',
          },
          {
            key: 'education_degree_attachment',
            label: 'Education Degree Attachment',
            type: PROFILE_FIELD_TYPES.FILE,
            accept: '.jpg,.jpeg,.png,.webp,.pdf',
          },
        ],
      },
    ],
  },
  {
    id: 'achievements',
    title: 'Achievements',
    helperText: 'Distinctions, scholarships, and awards.',
    naFieldName: 'achievements_not_applicable',
    naLabel: 'N/A',
    fields: [
      {
        fieldName: 'distinctions', label: 'Distinctions', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter distinctions',
      },
      {
        fieldName: 'scholarships', label: 'Scholarships', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter scholarships',
      },
      {
        fieldName: 'awards', label: 'Awards', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter awards',
      },
    ],
  },
  {
    id: 'languages',
    title: 'Languages',
    helperText: 'Language proficiency in speaking, reading, and writing.',
    repeatables: [
      {
        storageFieldName: 'language_proficiencies',
        addButtonLabel: 'Add language',
        itemLabel: 'Language',
        emptyRow: {
          language_name: '',
          speaking_proficiency: '',
          reading_proficiency: '',
          writing_proficiency: '',
        },
        columns: [
          { key: 'language_name', label: 'Language name', placeholder: 'Enter language name' },
          {
            key: 'speaking_proficiency', label: 'Speaking proficiency', type: PROFILE_FIELD_TYPES.SELECT, options: PROFICIENCY_OPTIONS,
          },
          {
            key: 'reading_proficiency', label: 'Reading proficiency', type: PROFILE_FIELD_TYPES.SELECT, options: PROFICIENCY_OPTIONS,
          },
          {
            key: 'writing_proficiency', label: 'Writing proficiency', type: PROFILE_FIELD_TYPES.SELECT, options: PROFICIENCY_OPTIONS,
          },
        ],
      },
    ],
  },
  {
    id: 'employment',
    title: 'Employment',
    helperText: 'First-job status, employment gap details, and employment record.',
    fields: [
      {
        fieldName: 'is_first_job', label: 'Is this your first job?', type: PROFILE_FIELD_TYPES.SELECT, options: YES_NO_OPTIONS,
      },
      {
        fieldName: 'first_employment_gap_details_after_education', label: 'First employment gap details after education', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter employment gap details',
      },
    ],
    repeatables: [
      {
        storageFieldName: 'employment_records',
        addButtonLabel: 'Add employment record',
        itemLabel: 'Employment record',
        emptyRow: {
          organization_office: '',
          designation_place_of_posting: '',
          from: '',
          to: '',
        },
        columns: [
          { key: 'organization_office', label: 'Organization / Office', placeholder: 'Enter organization or office' },
          { key: 'designation_place_of_posting', label: 'Designation & Place of Posting', placeholder: 'Enter designation and place of posting' },
          { key: 'from', label: 'From', type: PROFILE_FIELD_TYPES.DATE },
          { key: 'to', label: 'To', type: PROFILE_FIELD_TYPES.DATE },
        ],
      },
    ],
  },
  {
    id: 'competitiveExaminations',
    title: 'Competitive Examinations',
    helperText: 'Competitive exams and results.',
    naFieldName: 'competitive_examinations_not_applicable',
    naLabel: 'N/A',
    repeatables: [
      {
        storageFieldName: 'competitive_examinations',
        addButtonLabel: 'Add examination',
        itemLabel: 'Competitive examination',
        emptyRow: {
          examination_name: '',
          agency_holding_examination: '',
          year: '',
          result_details: '',
          merit_position_if_qualified: '',
        },
        columns: [
          { key: 'examination_name', label: 'Examination name', placeholder: 'Enter examination name' },
          { key: 'agency_holding_examination', label: 'Agency holding examination', placeholder: 'Enter agency name' },
          { key: 'year', label: 'Year', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: 'Enter year' },
          {
            key: 'result_details', label: 'Result details', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter result details',
          },
          { key: 'merit_position_if_qualified', label: 'Merit position, if qualified', placeholder: 'Enter merit position' },
        ],
      },
    ],
  },
  {
    id: 'cssExamDetails',
    title: 'CSS Exam Details',
    helperText: 'CSS summary, preferences, and marks.',
    fields: [
      { fieldName: 'css_roll_number', label: 'CSS Roll Number', placeholder: 'Enter CSS roll number' },
      { fieldName: 'css_merit_position', label: 'CSS Merit Position', placeholder: 'Enter CSS merit position' },
      {
        fieldName: 'css_chances_availed', label: 'CSS chances availed', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: '0',
      },
      {
        fieldName: 'applied_for_forthcoming_css_exam', label: 'Applied for forthcoming CSS exam', type: PROFILE_FIELD_TYPES.SELECT, options: YES_NO_OPTIONS,
      },
      {
        fieldName: 'intend_to_sit_for_forthcoming_css_exam', label: 'Intend to sit for forthcoming CSS exam', type: PROFILE_FIELD_TYPES.SELECT, options: YES_NO_OPTIONS,
      },
      { fieldName: 'last_chance_date_year', label: 'Last chance date / year', placeholder: 'Enter last chance date or year' },
    ],
    repeatables: [
      {
        storageFieldName: 'occupational_service_group_preferences',
        addButtonLabel: 'Add service group preference',
        itemLabel: 'Service group preference',
        autoPriorityKey: 'priority',
        emptyRow: {
          service_group: '',
          priority: '',
        },
        columns: [
          {
            key: 'service_group',
            label: 'Service group preference',
            placeholder: 'Enter service group preference',
          },
          {
            key: 'priority',
            label: 'Priority',
            type: PROFILE_FIELD_TYPES.NUMBER,
            placeholder: '1',
            displayOnly: true,
          },
        ],
      },
      {
        storageFieldName: 'css_subject_marks',
        addButtonLabel: 'Add subject mark',
        itemLabel: 'Subject mark',
        defaultRows: CSS_COMPULSORY_SUBJECT_MARKS,
        protectedRows: CSS_COMPULSORY_SUBJECT_MARKS,
        protectedRowKey: 'subject',
        protectedColumns: ['subject', 'total_marks'],
        emptyRow: {
          subject: '',
          total_marks: '',
          marks_obtained: '',
        },
        columns: [
          { key: 'subject', label: 'Subject', placeholder: 'Enter subject' },
          { key: 'total_marks', label: 'Total Marks', type: PROFILE_FIELD_TYPES.NUMBER, placeholder: 'Enter total marks' },
          {
            key: 'marks_obtained',
            label: 'Marks Obtained',
            type: PROFILE_FIELD_TYPES.NUMBER,
            placeholder: 'Enter marks obtained',
            validate: (value, row) => {
              if (row.total_marks !== '' && Number(value) > Number(row.total_marks)) {
                return 'Marks obtained cannot exceed total marks.';
              }
              return '';
            },
          },
        ],
      },
    ],
    fileFields: [
      {
        fieldName: 'css_marksheet_attachment',
        label: 'CSS Mark Sheet Attachment',
        accept: '.jpg,.jpeg,.png,.webp,.pdf',
      },
    ],
  },
  {
    id: 'governmentServiceDetails',
    title: 'Government Service Details',
    helperText: 'Dates, department, service, and income details.',
    fields: [
      { fieldName: 'date_joining_any_govt_service_before_csa', label: 'Date of joining any Govt. Service before CSA', type: PROFILE_FIELD_TYPES.DATE },
      { fieldName: 'department_name', label: 'Department name', placeholder: 'Enter department name' },
      { fieldName: 'date_joining_civil_services_academy_lahore', label: 'Date of joining Civil Services Academy, Lahore', type: PROFILE_FIELD_TYPES.DATE },
      { fieldName: 'date_joining_transfer_inland_revenue_service', label: 'Date of joining / transfer to Inland Revenue Service', type: PROFILE_FIELD_TYPES.DATE },
      {
        fieldName: 'other_income_source_besides_salary', label: 'Other income source besides salary', type: PROFILE_FIELD_TYPES.SELECT, options: YES_NO_OPTIONS,
      },
      {
        fieldName: 'other_income_details', label: 'Other income details', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter other income details',
      },
    ],
  },
  {
    id: 'personalInterests',
    title: 'Personal Interests',
    helperText: 'Games, distinctions, and hobbies.',
    fields: [
      {
        fieldName: 'games_played', label: 'Games played', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter games played',
      },
      {
        fieldName: 'game_distinctions_awards', label: 'Game distinctions / awards', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter game distinctions or awards',
      },
      {
        fieldName: 'hobbies', label: 'Hobbies', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter hobbies',
      },
    ],
  },
  {
    id: 'foreignVisits',
    title: 'Foreign Visits',
    helperText: 'Travel history in repeatable rows.',
    naFieldName: 'foreign_visits_not_applicable',
    naLabel: 'N/A',
    repeatables: [
      {
        storageFieldName: 'foreign_visits',
        addButtonLabel: 'Add foreign visit',
        itemLabel: 'Foreign visit',
        emptyRow: {
          country: '',
          purpose_of_visit: '',
          self_or_sponsored_visit: '',
          from: '',
          to: '',
        },
        columns: [
          { key: 'country', label: 'Country', placeholder: 'Enter country' },
          { key: 'purpose_of_visit', label: 'Purpose of visit', placeholder: 'Enter purpose of visit' },
          { key: 'self_or_sponsored_visit', label: 'Self or sponsored visit', placeholder: 'Enter self or sponsored' },
          { key: 'from', label: 'From', type: PROFILE_FIELD_TYPES.DATE },
          { key: 'to', label: 'To', type: PROFILE_FIELD_TYPES.DATE },
        ],
      },
    ],
  },
  {
    id: 'familyInformation',
    title: 'Family Information',
    helperText: 'Parents details.',
    fields: [
      { fieldName: 'father_name', label: 'Father Name', placeholder: 'Enter father name' },
      { fieldName: 'father_education', label: 'Father Education', placeholder: 'Enter father education' },
      { fieldName: 'father_occupation', label: 'Father Occupation', placeholder: 'Enter father occupation' },
      {
        fieldName: 'father_address', label: 'Father Address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter father address',
      },
      { fieldName: 'father_phone_number', label: 'Father Phone Number', placeholder: 'Enter father phone number' },
      { fieldName: 'mother_name', label: 'Mother Name', placeholder: 'Enter mother name' },
      { fieldName: 'mother_education', label: 'Mother Education', placeholder: 'Enter mother education' },
      { fieldName: 'mother_occupation', label: 'Mother Occupation', placeholder: 'Enter mother occupation' },
      {
        fieldName: 'mother_address', label: 'Mother Address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter mother address',
      },
      { fieldName: 'mother_phone_number', label: 'Mother Phone Number', placeholder: 'Enter mother phone number' },
    ],
  },
  {
    id: 'siblings',
    title: 'Siblings',
    helperText: 'Brother and sister details.',
    naFieldName: 'siblings_not_applicable',
    naLabel: 'N/A',
    repeatables: [
      {
        storageFieldName: 'siblings_family_information',
        addButtonLabel: 'Add family member',
        itemLabel: 'Brother / Sister',
        emptyRow: {
          relationship: '',
          name: '',
          education: '',
          occupation: '',
          address: '',
        },
        columns: [
          {
            key: 'relationship',
            label: 'Relationship',
            type: PROFILE_FIELD_TYPES.SELECT,
            options: [
              { value: '', label: 'Select relationship' },
              { value: 'brother', label: 'Brother' },
              { value: 'sister', label: 'Sister' },
            ],
          },
          { key: 'name', label: 'Name', placeholder: 'Enter name' },
          { key: 'education', label: 'Education', placeholder: 'Enter education' },
          { key: 'occupation', label: 'Occupation', placeholder: 'Enter occupation' },
          {
            key: 'address', label: 'Address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter address',
          },
        ],
      },
    ],
  },
  {
    id: 'closeRelativesInGovernmentService',
    title: 'Close Relatives in Government Service',
    helperText: 'Government service relatives in repeatable rows.',
    naFieldName: 'close_relatives_in_government_service_not_applicable',
    naLabel: 'N/A',
    repeatables: [
      {
        storageFieldName: 'close_relatives_in_government_service',
        addButtonLabel: 'Add relative',
        itemLabel: 'Relative',
        emptyRow: {
          name: '',
          designation: '',
          relationship: '',
          address: '',
        },
        columns: [
          { key: 'name', label: 'Relative Name', placeholder: 'Enter relative name' },
          { key: 'designation', label: 'Designation', placeholder: 'Enter designation' },
          { key: 'relationship', label: 'Relationship', placeholder: 'Enter relationship' },
          {
            key: 'address', label: 'Address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter address',
          },
        ],
      },
    ],
  },
  {
    id: 'spouseInformation',
    title: 'Spouse Information',
    helperText: 'Spouse education, occupation, and address.',
    fields: [
      { fieldName: 'spouse_name', label: 'Spouse Name', placeholder: 'Enter spouse name' },
      { fieldName: 'spouse_education', label: 'Spouse Education', placeholder: 'Enter spouse education' },
      { fieldName: 'spouse_occupation', label: 'Spouse Occupation', placeholder: 'Enter spouse occupation' },
      {
        fieldName: 'spouse_address', label: 'Spouse Address', type: PROFILE_FIELD_TYPES.TEXTAREA, placeholder: 'Enter spouse address',
      },
      { fieldName: 'spouse_phone', label: 'Spouse Phone', placeholder: 'Enter spouse phone' },
    ],
  },
  {
    id: 'declaration',
    title: 'Declaration',
    helperText: 'Confirm the information before submitting.',
    fields: [
      { fieldName: 'declaration_confirmed', label: 'I confirm that the information provided is correct.', type: PROFILE_FIELD_TYPES.CHECKBOX },
    ],
  },
];

export const BIODATA_SECTION_MAP = BIODATA_SECTIONS.reduce((accumulator, section) => {
  accumulator[section.id] = section;
  return accumulator;
}, {});
