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



















Complete CPMS features after Phase 4
1. Student Module
Students will be able to:
1. Log in securely using their credentials.
2. View a personalized student dashboard.
3. Track eligible placement drives.
4. View placement drive details, company, job role, package and location.
5. Check their academic eligibility for each drive.
6. Register for eligible placement drives.
7. View their registered drives and application status.
8. Track recruitment progress: Applied, Shortlisted, Interviewing, Selected and Rejected.
9. Receive real-time or periodically refreshed notifications.
10. Mark notifications as read.
11. View their academic profile and skills.
12. Upload and manage their profile photo.
13. Manage achievements and certifications.
14. View placement outcomes once officially verified.
2. Placement Officer Module
A. Placement Drive Management
1. Create new placement drives.
2. Edit drive details.
3. View all placement drives.
4. Track active and closed drives.
5. Archive and restore drives.
6. Permanently delete eligible archived drives, subject to dependency safeguards.
7. View registered applicants for each drive.
8. Monitor drive participation.
B. Student Eligibility Management
1. Configure academic eligibility criteria.
2. Set minimum 10th percentage.
3. Set minimum 12th/Diploma percentage.
4. Configure UG eligibility using CGPA, percentage or no UG criterion.
5. Automatically determine student eligibility.
6. Prevent ineligible students from applying.
7. Handle missing academic information safely.
C. Application Management
1. View applicants for each drive.
2. Filter and search students.
3. Update application status.
4. Track student recruitment progress.
5. View application records.
6. Protect verified placement records from accidental status changes.
D. Department-wise Attendance Management
1. View registered applicants grouped by department.
2. View department-wise attendance summaries.
3. Mark students Present, Absent or Pending.
4. Perform bulk attendance updates.
5. View attendance history.
6. Share department-specific attendance lists with HODs.
7. Share lists through WhatsApp and email.
8. Export attendance reports as CSV.
9. Print attendance reports with sign-off sections.
E. Department-wise HOD Coordination
1. Configure HOD contact information for each department.
2. Store HOD name, WhatsApp/mobile number, email and optional office location.
3. Reuse saved contact information when sharing reports.
4. Share individual student lists instead of only department totals.
5. Select all students or specific students.
6. Copy reports and export them for manual sharing.
F. Placement Outcome Verification — Phase 4
1. Identify applications marked Selected.
2. View applications awaiting verification.
3. Verify a student's placement outcome.
4. Enter optional CTC/package information.
5. Store verified outcomes separately from application records.
6. Revoke an incorrectly verified outcome with a mandatory reason.
7. Re-verify an outcome after correcting the application.
8. View complete verification and revocation history.
9. Prevent application status changes while an outcome remains verified.
10. Receive safe handling of duplicate and concurrent verification requests.
3. Placement Dashboard and Analytics
Your placement dashboard will provide:
Metric	Meaning
Total Students	Students registered in the platform
Total Drives	Placement drives created
Active Drives	Currently active drives
Closed Drives	Drives whose deadlines have passed
Total Applications	Student applications across drives
Eligible Students	Students satisfying drive criteria
Registered Applications	Applications submitted
In-progress Applications	Applications still in recruitment
Verified Selections	Distinct students with verified placement outcomes
Verified Offers	Total verified placement offers
Highest Package	Highest recorded verified CTC

Important distinction: One student selected by three companies counts as one Verified Selection and three Verified Offers. These metrics do not prove that the student accepted an offer or joined a company.
4. Notification System
Students will receive notifications for:
- New placement drive announcements.
- Application status updates.
- Verified placement outcomes.
- Other supported system notifications.
They can view unread notifications, mark individual notifications as read and mark all as read.
5. Security and Multi-Tenant SaaS Architecture
Your application will also have:
1. JWT-based authentication.
2. Role-based authorization.
3. Separate college data isolation.
4. College-scoped student, drive, application and outcome records.
5. Protected officer routes.
6. Server-side eligibility enforcement.
7. Secure application status updates.
8. Protected placement outcome verification.
9. Cross-college access prevention.
10. Safe drive deletion with dependency checks.
11. Automated backend security and regression tests.
6. Platform Roles
Role	Main responsibility
Super Admin	Platform-level college management
Placement Officer	Drive, application, attendance and placement management
Student	Profile, eligibility, applications and placement tracking
Recruiter	Recruiter role exists in the architecture; the recruiter portal is not part of the current implementation scope
HOD	Receives department reports through external sharing; no separate login/dashboard currently


7. What the complete application will deliver
Your CPMS feature coverage
Student
Portal and application tracking

Officer
Drive and applicant management

Attendance
Department-wise tracking

Outcomes
Verified placement records

Analytics
Placement metrics and reports

Security
Multi-tenant data protection



8. Features that are NOT included yet
Be clear about the boundaries. Completing these five phases does not automatically give you:
- HOD login and HOD dashboard.
- Recruiter self-service portal.
- Automated WhatsApp or email delivery.
- Student offer acceptance and joining confirmation.
- Automated recruiter integrations.
- Placement prediction using AI/ML.
- Advanced college-wide comparative analytics.
- Platform subscription and billing management.
These would be separate future development milestones.

My assessment: Once these five phases are completed and properly tested, you will have a substantial college placement management platform—not merely a student placement dashboard. Its strongest differentiators are department-level coordination, attendance tracking, academic eligibility enforcement, verified placement outcomes and strict multi-tenant architecture.