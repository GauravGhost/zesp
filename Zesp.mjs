import path from 'path';
import { promises as fs, writeFile } from 'fs';

import { diffLines } from 'diff';

import hashObject from './helpers/hashHelper.mjs';
import chalk from 'chalk';

class Zesp {
    constructor(repoPath = '.') {
        this.repoPath = path.join(repoPath, '.zesp');
        this.objectsPath = path.join(this.repoPath, 'object');
        this.headPath = path.join(this.repoPath, "HEAD");
        this.indexPath = path.join(this.repoPath, 'index');
        this.init();
    }

    async init() {
        await fs.mkdir(this.objectsPath, { recursive: true });
        try {
            await fs.writeFile(this.headPath, '', { flag: 'wx' });
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' })
        } catch (error) {
            console.log("Zesp repository already exists")
        }
    }

    async add(fileToBeAdded) {
        const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' });
        const fileHash = hashObject(fileData);
        console.log(fileHash);
        const newHashObjectFilePath = path.join(this.objectsPath, fileHash);
        // TODO: Add the file to the staging area
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
        const parentCommit = await this.getCurrentHead();

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

    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8' })

        } catch (error) {
            return null;
        }
    }

    async log() {
        let currentCommitHash = await this.getCurrentHead();
        while (currentCommitHash) {
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8' }));

            console.log(`Commit ${currentCommitHash} \nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`);

            currentCommitHash = commitData.parent;
        }
    }

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if (!commitData) {
            console.log("Commit not found!");
            return
        }
        console.log('Changes in the last commit are: ');

        for (const file of commitData.files) {
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent)

            if (commitData.parent) {
                // get the parent commit data.
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const parentFileContent = await this.getParentFileContent(parentCommitData, file.path);
                if (parentFileContent !== undefined) {
                    console.log('/nDiff: ');
                    // console.log(parentFileContent, fileContent)
                    const diff = diffLines(parentFileContent, fileContent);
                    // console.log(diff);
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

    async getCommitData(commitHash) {
        const commitPath = path.join(this.objectsPath, commitHash)
        try {
            return await fs.readFile(commitPath, { encoding: 'utf-8' })
        } catch (error) {
            console.error("Failed to read the commit data", error)
            return null;
        }
    }

    async getFileContent(fileHash) {
        const objectPath = path.join(this.objectsPath, fileHash)
        return fs.readFile(objectPath, { encoding: 'utf-8' });
    }

    async getParentFileContent(parentCommitData, filePath) {
        const parentFile = parentCommitData.files.find(file => file.path === filePath);
        if (parentFile) {
            // get file from parent commit and return the content
            return await this.getFileContent(parentFile.hash);
        }
    }
}

const zesp = new Zesp();
// await zesp.add('sample.txt');
// await zesp.add('sample2.txt');
// await zesp.commit("new updated sample.txt file");
// await zesp.log();
// await zesp.log();
await zesp.showCommitDiff('192c8effb19919d86a42aba5109927a977930147');