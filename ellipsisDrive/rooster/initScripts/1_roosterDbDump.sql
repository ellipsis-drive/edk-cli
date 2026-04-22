--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

--
-- Name: users; Type: TABLE; Schema: public; Owner: ellipsis_app
--

--
-- Name: users; Type: TABLE; Schema: public; Owner: ellipsis_app
--

CREATE TABLE public.users (
    id integer NOT NULL,
    uuid uuid NOT NULL,
    username character varying(255),
    password character varying(100),
    email character varying(128),
    coins numeric DEFAULT 0,
    commercial boolean DEFAULT false,
    about character varying(1500),
    registration_date timestamp without time zone,
    allow_contact boolean DEFAULT true,
    homepage character varying(255),
    avatar_file bytea,
    hubspot_info jsonb,
    stripe_customer_id character varying(64),
    active_card_id character varying(64),
    active_card_status character varying(32),
    last_billing_date timestamp without time zone DEFAULT to_timestamp((0)::double precision),
    disabled boolean DEFAULT false,
    went_negative_date timestamp without time zone,
    unvalidated_email character varying(128),
    email_validation_token uuid,
    email_validation_token_date timestamp without time zone,
    invited_by_user_id integer,
    location_id integer DEFAULT 1,
    contact_name character varying(100),
    country_id integer,
    vat_number character varying(200),
    address_number character varying(200),
    address_street character varying(200),
    address_zip character varying(50),
    address_city character varying(200),
    company_name character varying(200),
    name character varying(200),
    added_billing_information boolean DEFAULT false,
    is_company boolean DEFAULT false,
    stripe_3dsecure_info jsonb,
    google_id character varying(64),
    delete_date timestamp without time zone,
    recalculating_storage boolean DEFAULT false,
    is_organization boolean DEFAULT false,
    CONSTRAINT coins_not_nan CHECK (((coins <> 'NaN'::numeric) AND (coins IS NOT NULL)))
);


ALTER TABLE public.users OWNER TO ellipsis_app;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ellipsis_app
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO ellipsis_app;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ellipsis_app
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ellipsis_app
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ellipsis_app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_uuid_key; Type: CONSTRAINT; Schema: public; Owner: ellipsis_app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uuid_key UNIQUE (uuid);


--
-- Name: users_email_lowercase_idx; Type: INDEX; Schema: public; Owner: ellipsis_app
--

CREATE UNIQUE INDEX users_email_lowercase_idx ON public.users USING btree (lower((email)::text)) WHERE ((delete_date IS NULL) AND (is_organization = false));


--
-- Name: users_email_nonorg_idx; Type: INDEX; Schema: public; Owner: ellipsis_app
--

CREATE INDEX users_email_nonorg_idx ON public.users USING btree (email) WHERE ((delete_date IS NULL) AND (is_organization = false));



--
-- Name: users_unvalidated_email_lowercase_idx; Type: INDEX; Schema: public; Owner: ellipsis_app
--

CREATE UNIQUE INDEX users_unvalidated_email_lowercase_idx ON public.users USING btree (lower((unvalidated_email)::text));


--
-- Name: users_username_lowercase_idx; Type: INDEX; Schema: public; Owner: ellipsis_app
--

CREATE UNIQUE INDEX users_username_lowercase_idx ON public.users USING btree (lower((username)::text)) WHERE (delete_date IS NULL);


--
-- Name: users_username_nonorg_idx; Type: INDEX; Schema: public; Owner: ellipsis_app
--

CREATE INDEX users_username_nonorg_idx ON public.users USING btree (username) WHERE ((delete_date IS NULL) AND (is_organization = false));


--
-- PostgreSQL database dump complete
--
