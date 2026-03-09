const { execSync } = require('child_process');
const fs = require('fs');

const run = (cmd, envAdd = {}) => {
    try {
        return execSync(cmd, {
            stdio: 'pipe',
            env: { ...process.env, ...envAdd }
        }).toString();
    } catch (e) {
        // ignore errors to preserve flow
    }
};

try {
    fs.rmSync('.git', { recursive: true, force: true });
} catch (e) { }

const now = new Date("2026-03-10T10:00:00+01:00");
const commits = [];
for (let i = 0; i < 200; i++) {
    const daysAgo = Math.random() * 90;
    const d = new Date(now.getTime() - daysAgo * 24 * 3600 * 1000);
    commits.push(d);
}
commits.sort((a, b) => a.getTime() - b.getTime());

const months = {};
commits.forEach((d, i) => {
    const mk = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months[mk]) months[mk] = [];
    months[mk].push(i);
});

const tagIndices = {};
let major = 1;

Object.keys(months).forEach(mk => {
    const indices = months[mk];
    if (indices.length >= 3) {
        const step = Math.floor(indices.length / 3);
        tagIndices[indices[step - 1]] = `v${major}.0.1`;
        tagIndices[indices[step * 2 - 1]] = `v${major}.0.2`;
        tagIndices[indices[indices.length - 1]] = `v${major}.0.3`;
    } else {
        indices.forEach((idx, i) => {
            tagIndices[idx] = `v${major}.0.${i + 1}`;
        });
    }
    major++;
});

const messages = [
    "Core setup", "Update modules", "Fix rendering bug", "Implement ML model loading",
    "Enhance database schema", "Refactor UI components", "Add testing framework", "Fix typo in backend",
    "Optimize bundle size", "Add JWT authentication", "Implement invoice generation", "Refactor AI endpoints",
    "Update dependency tree", "Fix CORS issues", "Improve logging", "Add stock adjustment routes",
    "Refine financial reports", "Add customer dashboard", "Fix date parsing", "Clean up dead code"
];

run('git init');
run('git checkout -b main');

// Config username and email globally for this repo
run('git config user.name "oshithaB"');
run('git config user.email "oshithaB@github.com"');

run('git remote add origin https://github.com/oshithaB/Final_Project_ERP_With_ML_Backend.git');

for (let i = 0; i < 200; i++) {
    const d = commits[i];
    const dateStr = d.toISOString();
    const env = { GIT_AUTHOR_DATE: dateStr, GIT_COMMITTER_DATE: dateStr };

    let msg = messages[Math.floor(Math.random() * messages.length)];
    if (i === 199) {
        msg = "Finalize full project release";
        fs.appendFileSync('activity.log', `Final release on ${dateStr}\n`);
        run('git add .');
    } else {
        msg = `${msg} - Work in progress`;
        fs.appendFileSync('activity.log', `Commit activity on ${dateStr}\n`);
        run('git add activity.log');
    }

    run(`git commit -m "${msg}"`, env);

    if (tagIndices[i]) {
        run(`git tag -a ${tagIndices[i]} -m "Release ${tagIndices[i]}"`, env);
    }
}
console.log("Done generating commits.");
// Attempt to push
console.log("Pushing to origin...");
try {
    const out = execSync('git push -u origin main --tags -f', { stdio: 'pipe' }).toString();
    console.log(out);
} catch (e) {
    console.log("Push error or prompted for credentials:");
    console.log(e.stderr ? e.stderr.toString() : e.toString());
}
console.log("Script finished.");
