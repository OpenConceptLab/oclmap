# oclmap
OCL Mapper (beta) user interface. This open-source web application implements a collaborative terminology workflow that helps users to map spreadsheet-based input data to a target terminology stored in a OCL Terminology Server, such as LOINC, CIEL, ICD-10, or any custom data dictionary. The Mapper UI uses a AI-supported matching algorithm exposed by the OCL Terminology Server to generate candidates for mapping. Mapping healthcare data to standard terminologies is often the first step in an interoperability project, and it can be incredibly time consuming and costly, especially in resource-constrained environments that may have limited access to terminologists. Early tests of the matching algorithm (using vector embeddings and nearest neighbor search for candidate generation) demonstrated a ~60% improvement in the top-5 metric mapping our test datasets to the Columbia International eHealth Laboratory (hashtag#CIEL) interface terminology as compared to standard string matching approaches.

Development is being coordinated by the OCL Mapper Squad, consisting of team members from Madiro, LOINC, Regenstrief, and CIEL. Please reach out to learn more and to get involved.

### Run Dev
1. `docker-compose up -d`
2. Visit http://localhost:4004

### Run Dev with KeyCloak (SSO)
1. `docker-compose -f docker-compose.yml -f docker-compose.sso.yml up -d`
2. Visit http://localhost:4004

### Run Production (do check CORS origin policy with API_URL)
1. `docker-compose -f docker-compose.yml up -d`
2. Visit http://localhost:4004


### Eslint
```
docker exec -it <container_name> bash -c "eslint src --ext .jsx,.js"
```

### Test
```
docker exec -it oclmap-web-1 bash -c "npm test"
```

#### Major/minor version increase

In order to increase major/minor version you need to set the new version in [package.json](package.json).

### Evaluating Matching Algorithms with `mapeval.py`
`mapeval.py` is a simple CLI script (command-line interface) to evaluate the performance (e.g. matching accuracy, time, etc.) of a matching algorithm.
You must provide at least a file of the input data to be matched (`-f` or `--file`). The evaluation requires that the input spreadsheet has a column
with the ultimate mapping decision made. It can have one of three types of values:
* Concept ID, e.g. `1459` or `A10.1`
* "New" - if a new concept was proposed
* Empty - if the row was excluded (not mapped to a concept)

See all command line arguments like this:
```
python3 mapeval.py --help
```

Example:
```
python3 mapeval.py -t=[your-api-token] -r=/orgs/CIEL/sources/CIEL/v2023-09-11/ -e=https://api.qa.openconceptlab.org -f=./samples/NMRS\ Concept\ Request\ from\ CCFN\ 22012025\ final\ mappings.xlsx --correct=Correct\ Map\ CIEL\ Concept\ ID
```
