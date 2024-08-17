#!/usr/bin/env node

import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { Command } from 'commander'
import { diffLines } from 'diff';

import hashObject from './helpers/hashHelper.mjs';
import { getCommitData, getCurrentHead, getFileContent, getParentFileContent } from './helpers/utils.mjs'


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const program = new Command();

class Zesp {
    constructor(repoPath = '.') {
        this.repoPath = path.join(__dirname, repoPath, '.zesp');
        this.objectsPath = path.join(this.repoPath, 'object');
        this.headPath = path.join(this.repoPath, "HEAD");
        this.indexPath = path.join(this.repoPath, 'index');
    }

    async init() {
        await fs.mkdir(this.objectsPath, { recursive: true });
        try {
            await fs.writeFile(this.headPath, '', { flag: 'wx' });
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' });
            console.log(`Initialized the empty zesp repository`);
        } catch (error) {
            console.log("Zesp repository already exists");
        }
    }

    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' });
        const fileHash = hashObject(fileData);
        console.log(fileHash);
        const newHashObjectFilePath = path.join(this.objectsPath, fileHash);
        await fs.writeFile(newHashObjectFilePath, fileData);
        await this.updateStagingArea(fileToBeAdded, fileHash)
        console.log(`Added ${fileToBeAdded}`)
    }

    async updateStagingArea(filePath, fileHash) {
        const currentIndexFile = await fs.readFile(this.indexPath, { encoding: 'utf-8' })
        const index = JSON.parse(currentIndexFile);
        index.push({ path: filePath, hash: fileHash });
        await fs.writeFile(this.indexPath, JSON.stringify(index));
    }

    async commit(message) {
        const currentIndexFile = await fs.readFile(this.indexPath, { encoding: 'utf-8' })
        const index = JSON.parse(currentIndexFile);
        const parentCommit = await getCurrentHead(this.headPath);

        const commitData = {
            timeStamp: new Date().toISOString(),
            message: message,
            files: index,
            parent: parentCommit
        }
        const commitHash = hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData)); // making commit data
        await fs.writeFile(this.headPath, commitHash); // updating the head path
        await fs.writeFile(this.indexPath, JSON.stringify([])); // Clear the staging area
        console.log(`Commit Successfully Created ${commitHash}`);
    }

    async log() {
        let currentCommitHash = await getCurrentHead(this.headPath);
        console.log(currentCommitHash)
        while (currentCommitHash) {
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8' }));

            console.log(`Commit ${currentCommitHash} \nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`);

            currentCommitHash = commitData.parent;
        }
    }

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await getCommitData(this.objectsPath, commitHash));
        if (!commitData) {
            console.warn("Commit not found!");
            return
        }
        console.log('Changes in the last commit are: ');

        for (const file of commitData.files) {
            console.log(`File: ${file.path}`);
            const fileContent = await getFileContent(this.objectsPath, file.hash);
            console.log(fileContent)

            if (commitData.parent) {
                // get the parent commit data.
                const parentCommitData = JSON.parse(await getCommitData(this.objectsPath, commitData.parent));
                const parentFileContent = await getParentFileContent(this.objectsPath, parentCommitData, file.path);
                if (parentFileContent !== undefined) {
                    console.log('/nDiff: ');
                    // console.log(parentFileContent, fileContent)
                    const diff = diffLines(parentFileContent, fileContent);
                    diff.forEach(part => {
                        if (part.added) {
                            process.stdout.write(chalk.green(`++ ${part.value}`));
                            console.log();
                        } else if (part.removed) {
                            process.stdout.write(chalk.red(`-- ${part.value}`));
                            console.log();
                        } else {
                            process.stdout.write(chalk.grey(part.value))
                            console.log();
                        }
                    });
                    console.log();
                } else {
                    console.log("New file in this commit");
                }

            } else {
                console.log("First commit");
            }
        }

    }
}



program.command('init').action(async () => {
    const zesp = new Zesp();
    await zesp.init();
})

program.command('add <file>').action(async (file) =>{
    const zesp = new Zesp();
    await zesp.add(file);
});

program.command('commit -m <message>').action(async (message) => {
    const zesp = new Zesp();
    await zesp.commit(message);
});

program.command('log').action(async (commitHash) => {
    const zesp = new Zesp();
    await zesp.log();
});

program.command('show <commitHash>').action(async (commitHash) => {
    const zesp = new Zesp();
    await zesp.showCommitDiff(commitHash);
})


program.parse(process.argv);