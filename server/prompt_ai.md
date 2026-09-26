First, properly analyze the complete technical design before starting the development.

You have to analyze the **technical design, architecture diagram, and all the technical documents** properly and understand how the complete backend is supposed to work.

After understanding everything, create a **proper phase-wise development plan for the backend**.

Break the backend development into multiple phases and make sure that all phases are properly interconnected. There should be no dependency issues, calling issues, or conflicts between features implemented in different phases.

Maintain **one main plan folder** for the complete backend development and keep all phases properly organized inside it.

You can create multiple files inside the plan folder whenever required. For example, you can maintain separate files for:

* Overall backend architecture
* Database design
* API structure
* Service/module design
* Phase-wise implementation
* Dependencies between phases
* Background jobs and schedulers
* External integrations
* Important technical decisions
* Any other documentation required for proper implementation

For every phase, properly document what needs to be implemented, which components are required, what the dependencies are, which APIs/database changes are needed, and how that phase connects with the previous and upcoming phases.

The main goal is that when we start implementing **Phase 1**, it should be designed in a way that it will properly support Phase 2, Phase 3, and the later phases as well.

Do not implement something in an earlier phase in a way that creates problems when we implement a later feature.

Also make sure that the API contracts, database structure, services, background jobs, and other components remain consistent throughout all phases.

Before finalizing the plan, review the complete architecture again and verify that:

* All requirements from the technical documents are covered.
* All components from the architecture diagram are included.
* Dependencies between phases are properly handled.
* Database and API dependencies are correctly planned.
* Background jobs and scheduled tasks are connected properly.
* External services are integrated at the correct stage.
* There are no unnecessary circular dependencies.
* Later phases do not depend on something that has not been planned or implemented yet.
* The complete backend flow remains consistent with the original technical design.

Keep the plan updated whenever we make an architectural or implementation change during development.

Once the complete planning is finished, let me know.

After that, we will **go one by one through each phase and implement the backend step-by-step** according to the plan.
craete the paln foder for paln in server only as i am backend dvelopwrr you have to maintain all thong accprdong to that only 