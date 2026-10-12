import type { BrowseConfig } from './browse-state';

export const TABLE_CONFIGS = {
  "requests": {
    "sorts": [
      {
        "key": "reference",
        "label": "Reference",
        "category": "reference",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "resident",
        "label": "Resident",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "document",
        "label": "Document type",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "status",
        "label": "Status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "payment_status",
        "label": "Payment status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "submitted",
        "label": "Submitted",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "reference",
    "filters": {
      "tab": {
        "values": [
          "all",
          "active",
          "processing",
          "pickup",
          "completed",
          "cancelled"
        ],
        "defaultValue": "active"
      },
      "doc": {
        "values": [
          ""
        ],
        "defaultValue": ""
      }
    }
  },
  "transactions": {
    "sorts": [
      {
        "key": "created",
        "label": "Date created",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "reference",
        "label": "Request reference",
        "category": "reference",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "resident",
        "label": "Resident",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "document",
        "label": "Document type",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "method",
        "label": "Method",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "status",
        "label": "Status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "amount",
        "label": "Amount",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "paid",
        "label": "Paid date",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "refund",
        "label": "Refund date",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "created",
    "filters": {
      "tab": {
        "values": [
          "all",
          "pending",
          "paid",
          "failed",
          "expired",
          "refunded"
        ],
        "defaultValue": "all"
      },
      "method": {
        "values": [
          "",
          "pickup",
          "qrph"
        ],
        "defaultValue": ""
      }
    }
  },
  "residents": {
    "sorts": [
      {
        "key": "name",
        "label": "Name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "first_name",
        "label": "First name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "last_name",
        "label": "Last name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "email",
        "label": "Email",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "email_verification",
        "label": "Email verification",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "id_status",
        "label": "ID status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "joined",
        "label": "Joined",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "name",
    "filters": {
      "tab": {
        "values": [
          "all",
          "verified",
          "unverified"
        ],
        "defaultValue": "all"
      },
      "verification": {
        "values": [
          "",
          "with_id",
          "without_id"
        ],
        "defaultValue": ""
      }
    }
  },
  "incidents": {
    "sorts": [
      {
        "key": "submitted",
        "label": "Submitted",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "title",
        "label": "Title",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "category",
        "label": "Category",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "reporter",
        "label": "Reporter",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "status",
        "label": "Status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "confirmations",
        "label": "Confirmation count",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "submitted",
    "filters": {
      "tab": {
        "values": [
          "all",
          "open",
          "in_progress",
          "resolved",
          "withdrawn",
          "unresolved"
        ],
        "defaultValue": "open"
      },
      "category": {
        "values": [
          ""
        ],
        "defaultValue": ""
      }
    }
  },
  "health": {
    "sorts": [
      {
        "key": "created",
        "label": "Date created",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "title",
        "label": "Title",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "category",
        "label": "Category",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "drive_date",
        "label": "Drive date",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "active",
        "label": "Active state",
        "category": "boolean",
        "directionLabels": {
          "asc": "Inactive first",
          "desc": "Active first"
        },
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "registrations",
        "label": "Registration count",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "stock",
        "label": "Stock remaining",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "created",
    "filters": {
      "tab": {
        "values": [
          "all",
          "upcoming",
          "today",
          "past",
          "inactive"
        ],
        "defaultValue": "upcoming"
      },
      "type": {
        "values": [
          "",
          "vaccination",
          "maternal_care",
          "blood_drive",
          "medicine",
          "dental",
          "optical",
          "emergency_kit",
          "screening",
          "consultation",
          "minor_surgical",
          "others"
        ],
        "defaultValue": ""
      }
    }
  },
  "applicants": {
    "sorts": [
      {
        "key": "registered",
        "label": "Registered",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "number",
        "label": "Applicant number",
        "category": "reference",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "resident",
        "label": "Resident",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "drive",
        "label": "Drive title",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "category",
        "label": "Drive category",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "status",
        "label": "Status",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "age",
        "label": "Age",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "priority",
        "label": "Priority score",
        "category": "number",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "drive_date",
        "label": "Drive date",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "registered",
    "filters": {
      "tab": {
        "values": [
          "all",
          "pending",
          "confirmed",
          "attended",
          "cancelled"
        ],
        "defaultValue": "all"
      },
      "type": {
        "values": [
          "",
          "vaccination",
          "maternal_care",
          "blood_drive",
          "medicine",
          "dental",
          "optical",
          "emergency_kit",
          "screening",
          "consultation",
          "minor_surgical",
          "others"
        ],
        "defaultValue": ""
      }
    }
  },
  "households": {
    "sorts": [
      {
        "key": "name",
        "label": "Name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "head",
        "label": "Head name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "relation",
        "label": "Relation",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "role",
        "label": "Member role",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "checked_in",
        "label": "Check-in state",
        "category": "boolean",
        "directionLabels": {
          "asc": "Not checked in first",
          "desc": "Checked in first"
        },
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "center",
        "label": "Center",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "added",
        "label": "Added",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Date modified",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "check_in_date",
        "label": "Check-in date",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "name",
    "filters": {
      "tab": {
        "values": [
          "all",
          "checked_in",
          "not_checked_in"
        ],
        "defaultValue": "all"
      },
      "relation": {
        "values": [
          "",
          "spouse",
          "child",
          "parent",
          "sibling",
          "grandparent",
          "grandchild",
          "other"
        ],
        "defaultValue": ""
      }
    }
  },
  "staff": {
    "sorts": [
      {
        "key": "name",
        "label": "Name",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "role",
        "label": "Official role",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "email",
        "label": "Email",
        "category": "text",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "asc"
      },
      {
        "key": "hired",
        "label": "Hired",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "created",
        "label": "Staff-record creation",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "modified",
        "label": "Staff-record modification",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      },
      {
        "key": "profile_modified",
        "label": "Account-profile modification",
        "category": "date",
        "directions": [
          "asc",
          "desc"
        ],
        "initialDirection": "desc"
      }
    ],
    "defaultSort": "name",
    "filters": {
      "tab": {
        "values": [
          "all",
          "admin",
          "staff"
        ],
        "defaultValue": "all"
      },
      "role": {
        "values": [
          "",
          "admin",
          "staff",
          "barangay_captain",
          "kagawad",
          "sk_chairman",
          "secretary",
          "treasurer",
          "health_worker",
          "tanod",
          "clerk"
        ],
        "defaultValue": ""
      }
    }
  }
} as const satisfies Record<string, BrowseConfig>;
export type TableName = keyof typeof TABLE_CONFIGS;

export const TABLE_SUMMARY_KEYS = {
  "requests": [
    "submitted",
    "processing",
    "pickup",
    "completed",
    "cancelled"
  ],
  "transactions": [
    "cash",
    "qrph",
    "pending"
  ],
  "residents": [
    "total",
    "verified",
    "unverified",
    "withId",
    "withoutId",
    "idPending",
    "idVerified",
    "idFailed",
    "householdMembers"
  ],
  "incidents": [
    "open",
    "in_progress",
    "resolved",
    "withdrawn",
    "unresolved",
    "total"
  ],
  "health": [
    "total",
    "upcoming",
    "today",
    "past",
    "inactive",
    "registrations"
  ],
  "applicants": [
    "pending",
    "confirmed",
    "attended",
    "cancelled",
    "total",
    "pwd"
  ],
  "households": [
    "total",
    "checked_in",
    "not_checked_in",
    "spouse",
    "child",
    "parent",
    "other"
  ],
  "staff": [
    "total",
    "admin",
    "staff"
  ]
} as const;
