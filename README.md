# College Placement Management System (CPMS)

A modern full-stack College Placement Management Platform built with the MERN stack (MongoDB, Express.js, React.js, Node.js).

## Current Focus
Student Portal (End-to-End implementation):
- Phase 1: Authentication & Protected Sessions
- Phase 2: Student Dashboard & Analytics
- Phase 3: Academic Profile & Skills
- Phase 4: Placement Drives & Eligibility Engine
- Phase 5: Drive Registration & My Applications
- Phase 6: Attendance & Recruitment Rounds Tracking
- Phase 7: Real-time Notifications


😄 I didn't actually read your mind. Your previous description of “Super Admin may be Placement Head, Principal, Director” plus your goal of eventually letting other colleges use the platform naturally points toward that third architecture.
And yes — from now on, we should treat this as one long-running production SaaS project, not as disconnected prompts.
Our working rule from now on
I will track the project at three levels:
1. Current implementation status
What is actually built and tested in Antigravity.
2. Architecture decisions
What we have decided, so we don't keep redesigning the database every few days.
3. Production roadmap
Where we're ultimately going:
Platform
   │
   ├── Platform Super Admin
   │
   ├── College A
   │      ├── College Admin
   │      ├── HOD
   │      ├── Placement Officers
   │      └── Students
   │
   ├── College B
   │      ├── College Admin
   │      ├── HOD
   │      ├── Placement Officers
   │      └── Students
   │
   └── College C
          ...

And eventually:
Recruiter / Company ecosystem

But Recruiter Portal stays on hold for now, as you decided.
Where we are RIGHT NOW
Student Portal
Phase	Status
Phase 1 — Authentication	✅ Completed
Phase 2 — Dashboard & Analytics	✅ Completed
Phase 3 — Academic Profile & Skills	✅ Completed
Phase 4 — Drives & Eligibility	✅ Completed
Phase 5 — Registration & Applications	✅ Completed
Phase 6 — Attendance & Rounds	⏳ Next
Phase 7 — Notifications	⏳ Later


Architecture foundation
Feature	Status
JWT authentication	✅
Role system	✅ Foundation
College model	✅
collegeId	✅
companyId	✅ Foundation
Super Admin role	✅ Schema foundation
Data isolation	✅ Student side foundation
Privileged public registration blocked	✅
Existing data migration	✅
Student regression tests	✅


Portals
Student Portal          ✅ Current focus
Placement Officer       ⏳ Next major portal
Recruiter Portal        🛑 ON HOLD

Production SaaS
Multi-college architecture    🟡 Foundation started
College onboarding             ⏳
Platform Super Admin           ⏳
College Admin                  ⏳
Department/HOD                 ⏳
Production deployment          ⏳
Security hardening             ⏳

What you should do NOW
Don't give Antigravity another implementation prompt yet.
Your latest Antigravity work established the foundation, but before we build the Placement Officer Portal, we need to settle the organizational hierarchy.
Specifically:
PLATFORM SUPER ADMIN
        ↓
     COLLEGE
        ↓
   COLLEGE ADMIN
        ↓
   ┌────┴────┐
   ↓         ↓
  HOD    PLACEMENT OFFICER
   ↓         ↓
STUDENTS   PLACEMENT PROCESS

We need to decide whether College Admin, HOD, and Placement Head are separate roles or whether some are permissions under one role.
We also need to define exactly what each can see / create / update / delete.
For example, your earlier requirement:
HOD should see how many drives students attended, companies visited, IT/non-IT interest, rounds cleared, current placement status, etc.

That means HOD isn't simply another "admin." It needs department-scoped read access.
That's an important architectural requirement.
So our next step
We will do this one step at a time:
STEP 1 → Finalize organizational hierarchy
Platform
 ↓
Platform Super Admin
 ↓
College
 ↓
College-level administration
 ↓
Departments
 ↓
HOD
 ↓
Students

STEP 2 → Define permissions
Who can:
- create users
- deactivate users
- create drives
- modify drives
- view students
- view department analytics
- view college analytics
- enter attendance
- enter round results
- send notifications
- manage departments
STEP 3 → Define database relationships
Platform
 → College
 → Department
 → User
 → Student
 → Placement Drive
 → Application
 → Attendance
 → Recruitment Round
 → Result

STEP 4 → Give Antigravity one implementation task
Not 500 requirements at once.
STEP 5 → Test
STEP 6 → Update our project status
Then move to the next milestone.
Most important rule from now on
We don't let Antigravity decide the product architecture by itself.
You and I decide:
WHAT the system should be.

Antigravity decides:
HOW to implement that decision in the existing codebase.

And after every implementation, you bring its report here and I'll review it against our architecture.
That will keep this project from becoming an AI-generated pile of features.
----------
FOUNDATION 
----------

                         YOUR PLATFORM
                              │
                       PLATFORM SUPER ADMIN
                              │
              ┌───────────────┴───────────────┐
              ↓                               ↓
         COLLEGE A                        COLLEGE B
         REQUEST                           REQUEST
              │                               │
              └──────────────┐   ┌────────────┘
                             ↓   ↓
                         VERIFICATION
                             │
                       APPROVE / REJECT
                             │
                      APPROVED COLLEGE
                             │
                       COLLEGE ADMIN
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
        PLACEMENT HEAD      HODs      OTHER ADMINS
              │              │
              ↓              ↓
      PLACEMENT OFFICERS   DEPARTMENTS
              │              │
              │              ↓
              │           STUDENTS
              │              │
              ↓              │
       CREATE/MANAGE         │
       PLACEMENT DRIVES      │
              │              │
              └──────────────┤
                             ↓
                     AVAILABLE DRIVES
                             │
                             ↓
                     STUDENT DISCOVERS
                             │
                    ┌────────┴────────┐
                    ↓                 ↓
              ELIGIBILITY         INTEREST
               CHECK              / DOMAIN
                    │                 │
                    │          ┌──────┴──────┐
                    │          ↓             ↓
                    │        IT          NON-IT / CORE
                    │                 
                    └──────────┬──────┘
                               ↓
                        STUDENT DECIDES
                           TO APPLY
                               │
                               ↓
                     DRIVE REGISTRATION
                               │
                               ↓
                         APPLICATION
                               │
                               ↓
                         ATTENDANCE
                               │
                               ↓
                     RECRUITMENT ROUNDS
                               │
                  ┌────────────┼────────────┐
                  ↓            ↓            ↓
               Round 1      Round 2      Round 3...
                  │            │            │
                  └────────────┼────────────┘
                               ↓
                         ROUND RESULTS
                               │
                               ↓
                    PERFORMANCE TRACKING
                               │
                ┌──────────────┼──────────────┐
                ↓              ↓              ↓
          Drives Attended   Rounds      Current Status
          Companies        Cleared      Selected/Rejected
          Participated
                               │
                               ↓
                      STUDENT ANALYTICS
                               │
                               ↓
                     DEPARTMENT ANALYTICS
                               │
                               ↓
                      COLLEGE ANALYTICS




Ramraj, that's a good question. We should clarify the complete implementation order before asking Antigravity to write any code.
My previous roadmap did not separate the SaaS foundation from the two portals clearly enough. Let's correct that now.
1. The key idea: foundation first, then portals
Your application has three major layers:
Layer 1 — SaaS foundation
College isolation, authentication, roles, permissions, departments and onboarding

Student Portal
Discover drives, apply, track attendance, follow recruitment rounds and receive notifications


Placement Officer Portal
Create drives, manage registrations, record attendance, update recruitment rounds and analyze outcomes



Integration and testing
Both portals use the same trusted backend and consistent placement data


The foundation must come first because both portals need secure college and department boundaries. However, we should not postpone all portal development until the very end. The two portals depend on each other's workflows.
2. Our revised implementation roadmap
This is the order I recommend.
0

Codebase audit
Verify the existing code, database models, authentication, migrations and tests. Confirm which reported features actually work. Make no changes during this step.
Inspection only



1

SaaS foundation
Establish tenant isolation, college onboarding and approval, secure College Admin invitations, and safe college assignment. Remove the production dependency on the default-college fallback.



2

College administration
Implement department management, staff onboarding, HOD assignments, role-based permissions with controlled customization, and audit logging.



3

Placement Officer Portal
Build the core operational workflows: placement drives, student registrations, eligibility checks, attendance, recruitment rounds, results and department/college reporting. Implement only the workflows supported by the finalized requirements.



4

Complete and integrate the Student Portal
Preserve the existing Phases 1–5 if the audit confirms they work. Implement Phase 6 (Attendance and Recruitment Rounds) and Phase 7 (Notifications), connecting them to the Placement Officer workflows.



5

End-to-end verification
Test the full journey across roles and colleges, including student applications, attendance, round results, HOD visibility, authorization, tenant isolation and regression of existing features.



The Recruiter Portal remains on hold, as you previously decided.
3. Why I recommend building the Placement Officer Portal before finishing the Student Portal
Consider this real workflow:
Placement Officer

Creates a drive and defines eligibility.
Student

Views the drive, applies and tracks the application.
Placement Officer

Records attendance and updates recruitment-round results.
Student

Sees attendance, recruitment progress and notifications.
HOD

Views department-level participation and placement outcomes.
The Placement Officer Portal is the operational side of the system. The Student Portal is the student-facing side. Both must use the same underlying records rather than maintaining separate versions of the truth.
4. One important safeguard
Before Phase 1, the audit must confirm whether the existing authentication, college-scoped APIs and migrations are correct. We should reuse verified work and fix gaps rather than rebuild everything unnecessarily.
We will also split each implementation phase into small milestones. After every milestone, Antigravity must report changed files, tests and unresolved issues; you will share that report with me for review before we continue.
Let's agree on the order


My recommendation is to approve this sequence:
Audit → SaaS foundation → College administration → Placement Officer Portal → Student Portal completion → End-to-end verification.

---------------------------------------------------------------------
Milestone 1 — Security and test foundation
Fix tenant authorization bypasses, eliminate the insecure JWT-secret fallback, establish tests and correct broken Student Portal links.

Next



Milestone 2 — Multi-tenant data model
Normalize college and department relationships, profile/application ownership and tenant-specific uniqueness. Plan safe migrations.




Milestone 3 — Roles and permissions
Implement the agreed role hierarchy, delegation and controlled permission customization.




Milestones 4–6 — College administration
College approval, secure College Admin invitations, departments, staff management and hybrid student onboarding.




Milestones 7–9 — Portals and integration
Placement Officer Portal, HOD portal and analytics, then Student Portal completion and end-to-end verification.




1. What your completed project should look like









1. Platform Super Admin
Milestones 3–4
- Review college registration requests.
- Approve, reject, or request additional information.
- Activate colleges and initiate secure College Admin invitations.
- Oversee registered colleges and platform-level administration.
- Maintain separation between platform administration and college-level administration.












2. Placement Officer Portal
Milestone 7
- Create and manage placement drives.
- Set eligibility criteria.
- View eligible students and applications.
- Track registrations and participation.
- Manage interview rounds, attendance and results.
- Monitor placement progress and drive analytics.












3. Student Portal
Milestone 9
- Register or receive an invitation through an authorized college onboarding process.
- Manage their student profile, skills and career interests.
- Browse placement drives and check eligibility.
- Apply for eligible drives and track applications.
- View attendance, interview-round progress and results.
- Receive notifications and see meaningful dashboard analytics.












4. HOD Portal
Milestone 8
- View students in the assigned department.
- See placement status, applications, attendance and round-wise results.
- Track department placement performance.
- Compare relevant department-level statistics.
Access rule: read-only by default and restricted to the assigned department.












5. College Admin and staff management
Milestones 4–6
- Manage departments within the college.
- Invite and manage authorized staff.
- Configure approved role permissions.
- Onboard students through bulk imports, invitations or controlled self-registration.
- Keep college-specific records isolated from other colleges.



These are the expected functional areas, not screenshots of your current implementation. Their final appearance will depend on the existing UI and the work completed in each milestone.
2. How the entire system should work
Here is the intended end-to-end workflow.
Platform Super Admin
Verifies and approves a college

College Admin
Configures departments, staff, roles and onboarding

Placement Team
Drives, applications, attendance, rounds and results


Students
Profiles, eligibility, applications and progress



HODs and department analytics
Read-only visibility into their assigned department


All of these workflows must be enforced by the backend. For example, a student from College A must not be able to retrieve College B's placement drive simply by changing an ID in the URL or sending a modified API request.
3. What the underlying technical output should include
Area	Expected result
Frontend	Separate, functional interfaces for the agreed user roles
Backend	Organized APIs for authentication, onboarding, departments, drives, applications and results
Database	Explicit college ownership and consistent student, department, drive and application relationships
Authentication	Secure password hashing, validated JWT configuration and authenticated requests
Authorization	Centralized role, permission and tenant-scope enforcement
College onboarding	Approval workflow and secure invitations
Placement workflow	Drive creation through application tracking, attendance, rounds and results
Analytics	Dashboard data calculated from actual records rather than hardcoded counters
Testing	Automated tests for permissions, tenant isolation, relationships and core workflows
Documentation	Setup instructions, environment configuration, API details and migration instructions
Your existing Node.js, Express, MongoDB/Mongoose and React/Vite stack can support this target. You do not need to rewrite the project merely to achieve it.
4. What you should be able to demonstrate at the end
These are the acceptance checks I would use to judge whether the milestones are genuinely complete.
Final acceptance checklist
0 of 9



[ ] College onboarding
A college submits a request, gets approved and receives a secure administrator invitation.


[ ] Tenant isolation
Users from one college cannot access another college's protected data through direct API requests.


[ ] Department management
The same department name can exist in two colleges without mixing their records.


[ ] Student onboarding
Students are explicitly assigned to the correct college and department.


[ ] Drive lifecycle
An officer creates a drive, eligible students apply, and applications are tracked correctly.


[ ] Placement tracking
Attendance, interview rounds, results and student placement status stay consistent.


[ ] Role enforcement
College Admin, Placement Officer, HOD and Student each receive only their authorized access.


[ ] Live analytics
Dashboard counters and charts reflect actual database records.


[ ] End-to-end tests
Critical workflows and cross-tenant denial cases pass automated tests.



If you finish through Milestone 5 today, October 15, that would be a major achievement. You would have completed most of the foundational architecture and college administration setup. However, the Student Portal, Placement Officer Portal, HOD functionality, and final integration testing would still remain.

Let’s calculate the progress realistically.

## 1. Your project completion status

Projected status after completing Milestone 5

# \~50–60%

estimated planned work completed

This is a rough planning estimate, not a measured code-completion percentage. Milestones differ in size and complexity.

Your progress depends on the actual implementation and verification results, not just the number of milestones marked complete.

## 2. What will be completed after Milestone 5?

Milestones 0–2: Security and data foundation

M1 approved; M2 in progress

Authentication hardening, tenant-isolation tests, normalized data models, migration preparation, and verified database constraints. Milestone 2 still needs its final readiness review, controlled migration, and post-migration verification.

Milestone 3: Roles and permissions

Platform Super Admin, College Admin, Placement Head, Placement Officer, HOD, and Student—with backend-enforced permissions and tenant boundaries.

Milestones 4–5: College and staff administration

College registration and approval, secure College Admin invitations, department management, staff invitations, and authorized role assignments.

These are the foundational capabilities. They are necessary before we safely expand the system's student-facing and staff-facing features.

## 3. What will still be pending?

## M6

Secure student onboarding

Bulk imports, individual invitations, controlled self-registration, duplicate prevention, and correct college/department assignment.

## M7

Placement Officer Portal

Manage placement drives, companies, eligibility, student applications, attendance, and placement rounds within authorized college scope.

## M8

HOD Portal

Department-specific student visibility, placement progress, attendance, results, and analytics, with read-only access by default.

## M9

Complete the Student Portal

Real dashboard analytics, attendance, placement-round progress, notifications, profile integration, and end-to-end workflow consistency.

## QA

Final end-to-end verification

Test all roles, multiple colleges, cross-tenant access denial, onboarding, drive applications, attendance, results, notifications, and regressions.

The Recruiter Portal remains on hold, as previously decided.&#x20;

## 4. When will the project be fully complete?

There are two different finish lines.

Finish line A — Functional MVP

Complete Milestones 0–9, verify all role-specific workflows, and pass end-to-end testing. At this point, you should have a working multi-tenant College Placement Management System suitable for a serious portfolio demonstration.

Finish line B — Production-ready application

In addition to the MVP, complete deployment, production configuration, security review, monitoring, backups and recovery testing, email delivery, and operational checks. These are not automatically completed by Milestone 9.

My planning estimate: If you finish through Milestone 5 today, budget roughly 1–3 additional weeks for the remaining functional MVP work if you maintain a strong, consistent implementation pace with Antigravity. This is a planning range, not a guaranteed deadline; complex integration bugs or security issues could extend it. Production readiness would require additional time.

## 5. Today's priority

Don't sacrifice database safety just to mark five milestones complete. Follow this order:

1. Complete the Milestone 2F readiness review.
2. Approve and execute any necessary migration only after the backup, recovery plan, and exact write scope are reviewed.
3. Complete Milestones 2G and 2H with post-migration verification.
4. Implement and test Milestones 3, 4, and 5 one at a time.
5. Stop at Milestone 5 and review the complete implementation report.

My recommendation is to target a verified foundation first, then feature completeness. A working system with trustworthy tenant isolation is much more valuable than five milestones marked complete with untested permissions.





Day 1
Inspect

Freeze the scope and verify the existing app
- Start the backend, database and frontend.
- Test student and placement-officer login.
- Check the existing dashboard, profile, drives and applications.
- Identify only the blockers preventing the core workflow.
- Fix the highest-priority authentication or data-access issue.
  
  Deliverable: a working baseline and a short, ranked bug list.



Day 2
Complete

Finish the main placement workflow
- Officer creates or publishes a drive.
- Student sees the drive and its eligibility criteria.
- Eligible student applies.
- Officer sees the application.
- Student can see the correct application status.
- Fix API, database and UI issues blocking this sequence.
  
  Deliverable: one complete, working placement cycle.



Day 3
Verify

Test, polish and prepare the demonstration
- Test student and officer access separately.
- Check duplicate applications, ineligible applications and invalid inputs.
- Verify application data is associated with the correct college.
- Fix critical bugs and broken navigation.
- Prepare realistic demo data and a repeatable demonstration.
  
  Deliverable: a stable local MVP that you can confidently demonstrate.