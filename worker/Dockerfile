### image to use conda
FROM continuumio/miniconda3

# Setup working directory
WORKDIR /usr/src/worker

# Import conda environment.yml
ADD environment.yml /tmp/environment.yml
RUN conda env create -f /tmp/environment.yml

# Pull the codna environment name out of the environment.yml
ENV PATH /opt/conda/envs/star.byb.kr/bin:$PATH
ENV CONDA_DEFAULT_ENV star.byb.kr

## MAKE ALL BELOW RUN COMMANDS USE THE NEW CONDA ENVIRONMENT
SHELL ["conda", "run", "-n", "star.byb.kr", "/bin/bash", "-c"]

# Copy all local files into the image
COPY . .

# Run
CMD python -u worker.py ${WORKER}
