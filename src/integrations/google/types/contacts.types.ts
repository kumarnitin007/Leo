/**
 * Google Contacts (People API) types
 */

/** A typed value with an optional label (e.g. "home", "work", "mobile"). */
export interface ContactValue {
  value: string;
  type?: string | null;
}

/** A postal address (formatted + structured parts). */
export interface ContactAddress {
  formatted?: string | null;
  type?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

/** An organization / employment entry. */
export interface ContactOrganization {
  name?: string | null;
  title?: string | null;
  department?: string | null;
}

/** A related person (e.g. spouse, child). */
export interface ContactRelation {
  person: string;
  type?: string | null;
}

/** An instant-messaging handle. */
export interface ContactIm {
  username: string;
  protocol?: string | null;
}

/** A custom date event (anniversary, other). */
export interface ContactEvent {
  type?: string | null;
  date: string; // YYYY-MM-DD or MM-DD
}

/** A user-defined key/value field from Google Contacts. */
export interface ContactUserDefined {
  key: string;
  value: string;
}

/**
 * Full detail captured from the People API and stored in
 * myday_contacts.raw_details (JSONB). Top-level GoogleContact columns hold the
 * "primary" of each for fast search/typeahead; this holds everything.
 */
export interface ContactDetails {
  emails?: ContactValue[];
  phones?: ContactValue[];
  addresses?: ContactAddress[];
  organizations?: ContactOrganization[];
  occupations?: string[];
  nicknames?: string[];
  urls?: ContactValue[];
  relations?: ContactRelation[];
  ims?: ContactIm[];
  events?: ContactEvent[];
  userDefined?: ContactUserDefined[];
}

export interface GoogleContact {
  resourceName: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
  photoUrl: string | null;
  organization: string | null;
  notes: string | null;
  /** Favourite flag (local only, preserved across syncs). */
  isFavorite?: boolean;
  /** Full People API detail (all emails/phones/addresses/etc). */
  details?: ContactDetails | null;
}

export interface ContactRow {
  id: string;
  user_id: string;
  google_resource_name: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  birthday: string | null;
  anniversary: string | null;
  photo_url: string | null;
  organization: string | null;
  notes: string | null;
  leo_tags: string[] | null;
  is_favorite: boolean | null;
  raw_details: ContactDetails | null;
  last_synced: string | null;
}
