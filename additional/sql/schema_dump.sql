--
-- PostgreSQL database dump
--

\restrict qhLJikXhbfCenz2qX6bfOq3CrnyiQYRdTmSK88cRX3VQCI8WfahpLkBC9CmRqqE

-- Dumped from database version 16.13 (Debian 16.13-1.pgdg13+1)
-- Dumped by pg_dump version 16.13 (Debian 16.13-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_timeline; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.activity_timeline (
    id bigint NOT NULL,
    candidate_id text NOT NULL,
    login_id text NOT NULL,
    event_type text NOT NULL,
    event_data jsonb,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activity_timeline OWNER TO depthhire;

--
-- Name: activity_timeline_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.activity_timeline_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_timeline_id_seq OWNER TO depthhire;

--
-- Name: activity_timeline_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.activity_timeline_id_seq OWNED BY public.activity_timeline.id;


--
-- Name: analyses; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.analyses (
    id bigint NOT NULL,
    candidate_id text NOT NULL,
    job_id text NOT NULL,
    analyzed_at timestamp with time zone DEFAULT now() NOT NULL,
    consistency_score integer,
    capability_score integer,
    risk_level text,
    timeline_match_percent integer,
    analysis_json jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    candidate_name text,
    login_id text NOT NULL,
    ai_summary_json jsonb,
    fraud_signals_json jsonb,
    placement_prob_json jsonb
);


ALTER TABLE public.analyses OWNER TO depthhire;

--
-- Name: analyses_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.analyses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.analyses_id_seq OWNER TO depthhire;

--
-- Name: analyses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.analyses_id_seq OWNED BY public.analyses.id;


--
-- Name: candidates; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.candidates (
    id text NOT NULL,
    job_id text,
    name text NOT NULL,
    linkedin_url text,
    cv_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    login_id text NOT NULL,
    stage text DEFAULT 'Screening'::text NOT NULL,
    recruiter_notes text,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.candidates OWNER TO depthhire;

--
-- Name: coworker_messages; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.coworker_messages (
    id bigint NOT NULL,
    login_id text NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.coworker_messages OWNER TO depthhire;

--
-- Name: coworker_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.coworker_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coworker_messages_id_seq OWNER TO depthhire;

--
-- Name: coworker_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.coworker_messages_id_seq OWNED BY public.coworker_messages.id;


--
-- Name: coworker_tasks; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.coworker_tasks (
    id bigint NOT NULL,
    login_id text NOT NULL,
    task_type text NOT NULL,
    description text,
    status text DEFAULT 'pending'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    result_json jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


ALTER TABLE public.coworker_tasks OWNER TO depthhire;

--
-- Name: coworker_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.coworker_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.coworker_tasks_id_seq OWNER TO depthhire;

--
-- Name: coworker_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.coworker_tasks_id_seq OWNED BY public.coworker_tasks.id;


--
-- Name: email_history; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.email_history (
    id bigint NOT NULL,
    candidate_id text,
    login_id text NOT NULL,
    to_address text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    template_type text,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'Sent'::text NOT NULL
);


ALTER TABLE public.email_history OWNER TO depthhire;

--
-- Name: email_history_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.email_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_history_id_seq OWNER TO depthhire;

--
-- Name: email_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.email_history_id_seq OWNED BY public.email_history.id;


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.email_templates (
    id bigint NOT NULL,
    login_id text NOT NULL,
    template_type text NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    is_default boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_templates OWNER TO depthhire;

--
-- Name: email_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.email_templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_templates_id_seq OWNER TO depthhire;

--
-- Name: email_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.email_templates_id_seq OWNED BY public.email_templates.id;


--
-- Name: interviews; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.interviews (
    id text NOT NULL,
    candidate_id text NOT NULL,
    job_id text NOT NULL,
    login_id text NOT NULL,
    interviewer text,
    interview_type text,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    location text,
    meeting_link text,
    notes text,
    status text DEFAULT 'Scheduled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.interviews OWNER TO depthhire;

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.jobs (
    id text NOT NULL,
    title text NOT NULL,
    company text,
    job_type text,
    jd_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location text,
    login_id text NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    brief_text text,
    is_active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.jobs OWNER TO depthhire;

--
-- Name: login; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.login (
    id text NOT NULL,
    name text NOT NULL,
    company text,
    email text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    plan_id character varying(20) DEFAULT 'plan-free'::character varying NOT NULL,
    tokens_remaining integer DEFAULT 100 NOT NULL,
    renew_date date DEFAULT ((now())::date + '30 days'::interval) NOT NULL,
    phone_number text,
    stripe_customer_id text
);


ALTER TABLE public.login OWNER TO depthhire;

--
-- Name: plans; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.plans (
    id character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    max_jobs integer NOT NULL,
    max_candidates integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    max_tokens integer DEFAULT 100 NOT NULL
);


ALTER TABLE public.plans OWNER TO depthhire;

--
-- Name: reminders; Type: TABLE; Schema: public; Owner: depthhire
--

CREATE TABLE public.reminders (
    id bigint NOT NULL,
    login_id text NOT NULL,
    candidate_id text,
    title text NOT NULL,
    description text,
    reminder_type text DEFAULT 'MANUAL'::text NOT NULL,
    priority text DEFAULT 'Normal'::text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reminders OWNER TO depthhire;

--
-- Name: reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: depthhire
--

CREATE SEQUENCE public.reminders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reminders_id_seq OWNER TO depthhire;

--
-- Name: reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: depthhire
--

ALTER SEQUENCE public.reminders_id_seq OWNED BY public.reminders.id;


--
-- Name: activity_timeline id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.activity_timeline ALTER COLUMN id SET DEFAULT nextval('public.activity_timeline_id_seq'::regclass);


--
-- Name: analyses id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.analyses ALTER COLUMN id SET DEFAULT nextval('public.analyses_id_seq'::regclass);


--
-- Name: coworker_messages id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_messages ALTER COLUMN id SET DEFAULT nextval('public.coworker_messages_id_seq'::regclass);


--
-- Name: coworker_tasks id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_tasks ALTER COLUMN id SET DEFAULT nextval('public.coworker_tasks_id_seq'::regclass);


--
-- Name: email_history id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_history ALTER COLUMN id SET DEFAULT nextval('public.email_history_id_seq'::regclass);


--
-- Name: email_templates id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_templates ALTER COLUMN id SET DEFAULT nextval('public.email_templates_id_seq'::regclass);


--
-- Name: reminders id; Type: DEFAULT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.reminders ALTER COLUMN id SET DEFAULT nextval('public.reminders_id_seq'::regclass);


--
-- Name: activity_timeline activity_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.activity_timeline
    ADD CONSTRAINT activity_timeline_pkey PRIMARY KEY (id);


--
-- Name: analyses analyses_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_pkey PRIMARY KEY (id);


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: coworker_messages coworker_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_messages
    ADD CONSTRAINT coworker_messages_pkey PRIMARY KEY (id);


--
-- Name: coworker_tasks coworker_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_tasks
    ADD CONSTRAINT coworker_tasks_pkey PRIMARY KEY (id);


--
-- Name: email_history email_history_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT email_history_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: interviews interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: login login_email_unique; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.login
    ADD CONSTRAINT login_email_unique UNIQUE (email);


--
-- Name: login login_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.login
    ADD CONSTRAINT login_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_candidate_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_activity_candidate_id ON public.activity_timeline USING btree (candidate_id);


--
-- Name: idx_activity_created_at; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_activity_created_at ON public.activity_timeline USING btree (created_at DESC);


--
-- Name: idx_activity_event_type; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_activity_event_type ON public.activity_timeline USING btree (event_type);


--
-- Name: idx_activity_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_activity_login_id ON public.activity_timeline USING btree (login_id);


--
-- Name: idx_analyses_analyzed_at; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_analyses_analyzed_at ON public.analyses USING btree (analyzed_at DESC);


--
-- Name: idx_analyses_candidate_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_analyses_candidate_id ON public.analyses USING btree (candidate_id);


--
-- Name: idx_analyses_job_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_analyses_job_id ON public.analyses USING btree (job_id);


--
-- Name: idx_analyses_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_analyses_login_id ON public.analyses USING btree (login_id);


--
-- Name: idx_candidates_is_active; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_candidates_is_active ON public.candidates USING btree (is_active);


--
-- Name: idx_candidates_job_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_candidates_job_id ON public.candidates USING btree (job_id);


--
-- Name: idx_candidates_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_candidates_login_id ON public.candidates USING btree (login_id);


--
-- Name: idx_coworker_messages_login; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_coworker_messages_login ON public.coworker_messages USING btree (login_id, created_at DESC);


--
-- Name: idx_coworker_tasks_login; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_coworker_tasks_login ON public.coworker_tasks USING btree (login_id);


--
-- Name: idx_coworker_tasks_status; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_coworker_tasks_status ON public.coworker_tasks USING btree (login_id, status);


--
-- Name: idx_email_history_candidate_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_email_history_candidate_id ON public.email_history USING btree (candidate_id);


--
-- Name: idx_email_history_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_email_history_login_id ON public.email_history USING btree (login_id);


--
-- Name: idx_email_history_sent_at; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_email_history_sent_at ON public.email_history USING btree (sent_at DESC);


--
-- Name: idx_email_templates_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_email_templates_login_id ON public.email_templates USING btree (login_id);


--
-- Name: idx_interviews_candidate_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_interviews_candidate_id ON public.interviews USING btree (candidate_id);


--
-- Name: idx_interviews_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_interviews_login_id ON public.interviews USING btree (login_id);


--
-- Name: idx_interviews_scheduled_at; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_interviews_scheduled_at ON public.interviews USING btree (scheduled_at DESC);


--
-- Name: idx_interviews_status; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_interviews_status ON public.interviews USING btree (status);


--
-- Name: idx_jobs_is_active; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_jobs_is_active ON public.jobs USING btree (is_active);


--
-- Name: idx_jobs_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_jobs_login_id ON public.jobs USING btree (login_id);


--
-- Name: idx_login_email; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_login_email ON public.login USING btree (email);


--
-- Name: idx_login_plan_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_login_plan_id ON public.login USING btree (plan_id);


--
-- Name: idx_reminders_candidate_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_reminders_candidate_id ON public.reminders USING btree (candidate_id);


--
-- Name: idx_reminders_due_at; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_reminders_due_at ON public.reminders USING btree (due_at);


--
-- Name: idx_reminders_is_completed; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_reminders_is_completed ON public.reminders USING btree (is_completed);


--
-- Name: idx_reminders_login_id; Type: INDEX; Schema: public; Owner: depthhire
--

CREATE INDEX idx_reminders_login_id ON public.reminders USING btree (login_id);


--
-- Name: activity_timeline activity_timeline_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.activity_timeline
    ADD CONSTRAINT activity_timeline_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: activity_timeline activity_timeline_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.activity_timeline
    ADD CONSTRAINT activity_timeline_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: analyses analyses_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: analyses analyses_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: analyses analyses_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.analyses
    ADD CONSTRAINT analyses_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: candidates candidates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: candidates candidates_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: coworker_messages coworker_messages_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_messages
    ADD CONSTRAINT coworker_messages_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: coworker_tasks coworker_tasks_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.coworker_tasks
    ADD CONSTRAINT coworker_tasks_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: email_history email_history_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT email_history_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE SET NULL;


--
-- Name: email_history email_history_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_history
    ADD CONSTRAINT email_history_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: interviews interviews_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.interviews
    ADD CONSTRAINT interviews_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- Name: login login_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.login
    ADD CONSTRAINT login_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: reminders reminders_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE SET NULL;


--
-- Name: reminders reminders_login_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: depthhire
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_login_id_fkey FOREIGN KEY (login_id) REFERENCES public.login(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict qhLJikXhbfCenz2qX6bfOq3CrnyiQYRdTmSK88cRX3VQCI8WfahpLkBC9CmRqqE

